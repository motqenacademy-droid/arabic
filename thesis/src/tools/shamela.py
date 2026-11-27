#!/usr/bin/env python3
"""CLI for the Shamela MCP server.
Usage: python3 -I shamela.py <tool> '<json-args>'
tools: shamela_find, shamela_find_scoped, shamela_open, shamela_open_many"""
import json, sys, urllib.request
URL = "https://mcp.shamela.ws"
def call(method, params, i=1):
    req = urllib.request.Request(URL, data=json.dumps({"jsonrpc":"2.0","id":i,"method":method,"params":params}).encode(),
        headers={"Content-Type":"application/json","Accept":"application/json, text/event-stream"})
    raw = urllib.request.urlopen(req, timeout=120).read().decode()
    if raw.lstrip().startswith("event:") or raw.lstrip().startswith("data:"):
        raw = "\n".join(l[5:] for l in raw.splitlines() if l.startswith("data:"))
    return json.loads(raw)
tool, args = sys.argv[1], json.loads(sys.argv[2])
r = call("tools/call", {"name": tool, "arguments": args})
if "error" in r: print(json.dumps(r["error"], ensure_ascii=False)); sys.exit(1)
for c in r["result"].get("content", []):
    if c.get("type") == "text": print(c["text"])
sc = r["result"].get("structuredContent")
if sc and not r["result"].get("content"): print(json.dumps(sc, ensure_ascii=False, indent=1))
