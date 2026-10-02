"""Compare vision models on the synthetic fixtures through OpenRouter.

  OPENROUTER_API_KEY=... python3 scripts/bench-models.py google/gemini-3.1-flash-lite,google/gemma-4-26b-a4b-it '<extra-json>' [img1.jpg,img2.jpg]

The optional second argument is merged into the request body (e.g. response_format and provider preferences).
Prints per-model field accuracy, cost and latency. Costs are OpenRouter's own usage.cost.
"""
import os,sys,json,re,base64,time,urllib.request
repo=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(repo+'/src/lib/extraction.ts').read()
sysp=re.search(r"EXTRACT_SYSTEM_PROMPT = `(.*?)`;",src,re.S).group(1)
key=os.environ['OPENROUTER_API_KEY']
truth=json.load(open(repo+'/test/fixtures/truth.json'))
schema={"name":"contact","strict":True,"schema":{"type":"object","additionalProperties":False,"required":["firstName","lastName","title","company","email","phone","website","notes","confidence"],"properties":{k:{"type":"string"} for k in ["firstName","lastName","title","company","email","phone","website","notes"]}|{"confidence":{"type":"number"}}}}
def call(model,img,extra):
    b=base64.b64encode(open(repo+'/test/fixtures/'+img,'rb').read()).decode()
    body={"model":model,"temperature":0,"max_tokens":500,"usage":{"include":True},
      "messages":[{"role":"system","content":sysp},{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+b}},{"type":"text","text":"Extract the contact details from this photo."}]}]}
    body.update(extra)
    req=urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
    t=time.time()
    try:
        r=json.load(urllib.request.urlopen(req,timeout=90))
    except Exception as e:
        body=getattr(e,'read',lambda:b'')().decode()[:300]
        return {"err":str(e)+" "+body}
    return {"r":r,"ms":int((time.time()-t)*1000)}
def norm(s): return re.sub(r'\s+',' ',str(s or '')).strip().lower()
models=sys.argv[1].split(',')
extra=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
imgs=sys.argv[3].split(',') if len(sys.argv)>3 else list(truth)
log=open(os.path.join(repo,'docs','verification','model-bench-spend.jsonl'),'a')
for m in models:
    tot=0;ok=0;n=0;ms=[]
    for im in imgs:
        res=call(m,im,extra)
        if 'err' in res: print(m,im,'ERR',res['err']); continue
        r=res['r']; u=r.get('usage',{}); c=u.get('cost',0) or 0; tot+=c
        txt=r['choices'][0]['message'].get('content') or ''
        log.write(json.dumps({"model":m,"img":im,"cost":c,"usage":u})+'\n'); log.flush()
        try:
            d=json.loads(re.search(r'\{.*\}',txt,re.S).group(0))
        except Exception: d={}
        t=truth[im]
        for k,v in t.items():
            n+=1
            if norm(d.get(k))==norm(v): ok+=1
            else: print('  MISS',m.split('/')[1],im,k,'exp=',repr(v),'got=',repr(d.get(k)))
        ms.append(res['ms'])
    print(f"== {m}: {ok}/{n} fields, cost ${tot:.5f} total, {tot/max(1,len(ms)):.5f}/img, avg {sum(ms)//max(1,len(ms))}ms",flush=True)
