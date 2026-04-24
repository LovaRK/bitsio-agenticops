"""Tests for local-first ModelSelectionEngine privacy enforcement."""

import pytest

from agent_core.models.adapter import (
    ModelProvider,
    ModelSelectionEngine,
    RuntimeMode,
    SecurityError,
    UserModelSettings,
    enforce_privacy_contract,
)


class TestLocalFirstDefault:
    """Verify local models are default in LOCAL_FIRST mode."""

    def test_default_uses_local_model(self):
        """User with no preferences should get local Ollama."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)
        user_settings = UserModelSettings(use_cloud=False)

        provider, model, adapter = engine.select_model(user_settings)

        assert provider == ModelProvider.OLLAMA
        assert model == "qwen2.5:7b"

    def test_local_first_mode_name(self):
        """Engine should identify its mode."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)
        assert engine.runtime_mode == RuntimeMode.LOCAL_FIRST


class TestUserOptIn:
    """Verify users can opt-in to cloud models."""

    def test_user_opts_in_with_configured_cloud(self):
        """User can opt-in if cloud provider is configured."""
        engine = ModelSelectionEngine(
            runtime_mode=RuntimeMode.LOCAL_FIRST,
            anthropic_model="claude-sonnet-4-20250514",
        )
        # Mock API key by setting it in the engine
        engine.anthropic_api_key = "test-key"

        user_settings = UserModelSettings(
            use_cloud=True, preferred_cloud_provider=ModelProvider.ANTHROPIC
        )

        provider, model, adapter = engine.select_model(user_settings)

        assert provider == ModelProvider.ANTHROPIC
        assert model == "claude-sonnet-4-20250514"

    def test_user_opt_in_without_configured_provider_raises(self):
        """User opt-in fails if cloud provider not configured."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)

        user_settings = UserModelSettings(
            use_cloud=True, preferred_cloud_provider=ModelProvider.ANTHROPIC
        )

        with pytest.raises(SecurityError):
            engine.select_model(user_settings)


class TestLocalOnlyMode:
    """Verify LOCAL_ONLY mode prevents all cloud access."""

    def test_local_only_always_returns_local(self):
        """LOCAL_ONLY mode never returns cloud, even with opt-in."""
        engine = ModelSelectionEngine(
            runtime_mode=RuntimeMode.LOCAL_ONLY,
            anthropic_model="claude-sonnet-4-20250514",
        )
        engine.anthropic_api_key = "test-key"

        user_settings = UserModelSettings(
            use_cloud=True, preferred_cloud_provider=ModelProvider.ANTHROPIC
        )

        provider, model, adapter = engine.select_model(user_settings)

        assert provider == ModelProvider.OLLAMA

    def test_local_only_prevents_cloud_via_select_model(self):
        """Enforcing privacy should raise if cloud is attempted in LOCAL_ONLY."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_ONLY)
        engine.anthropic_api_key = "test-key"

        # User tries to opt-in, but LOCAL_ONLY blocks it
        user_settings = UserModelSettings(
            use_cloud=True, preferred_cloud_provider=ModelProvider.ANTHROPIC
        )

        # select_model should still return local model, not cloud
        provider, model, adapter = engine.select_model(user_settings)
        assert provider == ModelProvider.OLLAMA


class TestPrivacyContractEnforcement:
    """Verify enforce_privacy_contract blocks unauthorized cloud usage."""

    def test_privacy_contract_blocks_cloud_without_user_opt_in(self):
        """Cloud models blocked if user has not opted in."""
        user_settings = UserModelSettings(use_cloud=False)

        with pytest.raises(
            SecurityError, match="Cloud model usage not allowed"
        ):
            enforce_privacy_contract(
                ModelProvider.ANTHROPIC,
                user_settings,
                RuntimeMode.LOCAL_FIRST,
            )

    def test_privacy_contract_allows_cloud_with_user_opt_in(self):
        """Cloud models allowed if user has opted in."""
        user_settings = UserModelSettings(use_cloud=True)

        # Should not raise
        enforce_privacy_contract(
            ModelProvider.ANTHROPIC,
            user_settings,
            RuntimeMode.LOCAL_FIRST,
        )

    def test_privacy_contract_allows_local_always(self):
        """Local models always allowed regardless of opt-in."""
        user_settings = UserModelSettings(use_cloud=False)

        # Should not raise
        enforce_privacy_contract(
            ModelProvider.OLLAMA,
            user_settings,
            RuntimeMode.LOCAL_FIRST,
        )


class TestMetadataCreation:
    """Verify transparency metadata is created correctly."""

    def test_metadata_shows_local_mode(self):
        """Metadata should indicate local mode."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)

        metadata = engine.create_metadata(
            provider=ModelProvider.OLLAMA,
            model="qwen2.5:7b",
            user_opt_in=False,
        )

        assert metadata.provider == "ollama"
        assert metadata.model == "qwen2.5:7b"
        assert metadata.mode == "local"
        assert metadata.user_opt_in is False
        assert metadata.runtime_mode == "local_first"

    def test_metadata_shows_cloud_mode(self):
        """Metadata should indicate cloud mode when used."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)

        metadata = engine.create_metadata(
            provider=ModelProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            user_opt_in=True,
        )

        assert metadata.provider == "anthropic"
        assert metadata.model == "claude-sonnet-4-20250514"
        assert metadata.mode == "cloud"
        assert metadata.user_opt_in is True

    def test_metadata_is_serializable(self):
        """Metadata should serialize to JSON."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.LOCAL_FIRST)

        metadata = engine.create_metadata(
            provider=ModelProvider.OLLAMA,
            model="qwen2.5:7b",
            user_opt_in=False,
        )

        data = metadata.model_dump()
        assert "timestamp" in data
        assert isinstance(data["timestamp"], str)


class TestCloudAllowedMode:
    """Verify CLOUD_ALLOWED mode behavior."""

    def test_cloud_allowed_default_still_local(self):
        """Even in CLOUD_ALLOWED, default should be local."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.CLOUD_ALLOWED)
        user_settings = UserModelSettings(use_cloud=False)

        provider, model, adapter = engine.select_model(user_settings)

        assert provider == ModelProvider.OLLAMA

    def test_cloud_allowed_permits_opt_in(self):
        """CLOUD_ALLOWED mode allows opt-in like LOCAL_FIRST."""
        engine = ModelSelectionEngine(runtime_mode=RuntimeMode.CLOUD_ALLOWED)
        engine.anthropic_api_key = "test-key"

        user_settings = UserModelSettings(
            use_cloud=True, preferred_cloud_provider=ModelProvider.ANTHROPIC
        )

        provider, model, adapter = engine.select_model(user_settings)

        assert provider == ModelProvider.ANTHROPIC
