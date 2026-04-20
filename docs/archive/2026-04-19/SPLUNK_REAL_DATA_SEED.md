# Splunk Real Data Seeding for Telemetry Value Impact

Use this when `/telemetry-value?source=live` looks too empty.

## Prerequisites
- Splunk user with permission to run `collect` into `index=tutorial`.
- Open Splunk Search app at:
  - `http://144.202.48.85:8000/en-US/app/search/search`

## Step 1: Create realistic "wasteful" sourcetypes
Run each query once in Splunk Search.

### A) Cisco ASA-like stream (high ingest, usually low search)
```spl
| makeresults count=8000
| eval _time=now()-random()%7776000
| eval sourcetype="cisco:asa"
| eval host="fw-".(1+random()%6)
| eval src_ip="10.10.".tostring(random()%255).".".tostring(random()%255)
| eval dst_ip="172.16.".tostring(random()%255).".".tostring(random()%255)
| eval dst_port=53+random()%60000
| eval action=if(random()%10<8,"allow","deny")
| eval _raw="asa event action=".action." src=".src_ip." dst=".dst_ip." dpt=".dst_port
| collect index=tutorial marker="bitsio_seed_asa"
```

### B) Microsoft 365 activity-like stream
```spl
| makeresults count=6000
| eval _time=now()-random()%7776000
| eval sourcetype="ms365:activity"
| eval host="m365-tenant-01"
| eval user="user".(1+random()%300)."@example.com"
| eval operation=mvindex(split("FileAccessed,FileDownloaded,UserLoggedIn,MailboxLogin",","),random()%4)
| eval workload=mvindex(split("SharePoint,Exchange,OneDrive,Teams",","),random()%4)
| eval _raw="m365 op=".operation." user=".user." workload=".workload
| collect index=tutorial marker="bitsio_seed_m365"
```

### C) Cisco ISE-like auth stream
```spl
| makeresults count=5000
| eval _time=now()-random()%7776000
| eval sourcetype="cisco:ise"
| eval host="ise-".(1+random()%3)
| eval endpoint="device-".(1000+random()%9000)
| eval result=if(random()%10<7,"success","failure")
| eval _raw="ise auth endpoint=".endpoint." result=".result
| collect index=tutorial marker="bitsio_seed_ise"
```

## Step 2: Validate data exists
```spl
search index=tutorial (marker="bitsio_seed_asa" OR marker="bitsio_seed_m365" OR marker="bitsio_seed_ise")
| stats count by sourcetype
```

## Step 3: Refresh app
1. Open `http://127.0.0.1:3000/settings`
2. Keep:
   - `Use Live Splunk Data = ON`
   - `Splunk Adapter Mode = native`
3. Open `http://127.0.0.1:3000/telemetry-value?source=live`
4. Hard refresh browser once (`Cmd+Shift+R`).

## Expected result
- More `Top Offenders` rows.
- Higher `Daily Wasted GB` and `Annual Savings`.
- New recommendations for the seeded sourcetypes.
