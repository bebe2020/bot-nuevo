"""Inferencia real del modelo público Kronos-mini; sin cuentas ni órdenes."""
import argparse
import hashlib
import json
import time
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'vendor'/'kronos'))

def infer(input_path, output_path, symbols=None, steps=16, samples=3):
    import numpy as np
    import pandas as pd
    import torch
    from model import Kronos, KronosTokenizer, KronosPredictor
    torch.set_num_threads(2)
    torch.manual_seed(20261107)
    np.random.seed(20261107)
    started=time.time()
    source=json.loads(Path(input_path).read_text())
    rows=[r for r in source['items'] if r.get('bars') and len(r['bars'])>=96 and (not symbols or r['symbol'] in symbols)]
    cache=ROOT.parent/'.local'/'kronos-models'
    tokenizer=KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-2k',cache_dir=str(cache),revision='26966d0035065a0cae0ebad7af8ece35bc1fb51c')
    model=Kronos.from_pretrained('NeoQuasar/Kronos-mini',cache_dir=str(cache),revision='f4e68697d9d5aed55cef5c96aabc3376bcad9f81').eval()
    predictor=KronosPredictor(model,tokenizer,device='cpu',max_context=128)
    output={'version':'kronos-mini-v1','model':'NeoQuasar/Kronos-mini','tokenizer':'NeoQuasar/Kronos-Tokenizer-2k','codeCommit':'67b630e67f6a18c9e9be918d9b4337c960db1e9a','modelRevision':'f4e68697d9d5aed55cef5c96aabc3376bcad9f81','tokenizerRevision':'26966d0035065a0cae0ebad7af8ece35bc1fb51c','engine':'PYTORCH_REAL_CPU','seed':20261107,'sampleCount':samples,'temperature':1.0,'topP':0.9,'amountMethod':'MEDIA_OHLC_POR_VOLUMEN_BASE_ESTIMADA_POR_EL_PREDICTOR_OFICIAL','items':[],'accountData':False}
    for offset in range(0,len(rows),4):
        batch=rows[offset:offset+4]; dfs=[]; xs=[]; ys=[]; meta=[]
        for r in batch:
            b=np.array(r['bars'][-128:],dtype=np.float64)
            if b.ndim!=2 or b.shape[1]!=6 or not np.isfinite(b).all():raise ValueError('OHLCV no válido')
            if not np.all(np.diff(b[:,0])==900000) or b[-1,0]+900000>time.time()*1000:raise ValueError('Huecos o vela abierta')
            times=pd.Series(pd.to_datetime(b[:,0],unit='ms',utc=True).tz_convert(None))
            future=pd.Series(pd.date_range(times.iloc[-1]+pd.Timedelta(minutes=15),periods=steps,freq='15min'))
            frame=pd.DataFrame(b[:,1:],columns=['open','high','low','close','volume'])
            for _ in range(samples):dfs.append(frame);xs.append(times);ys.append(future)
            meta.append((r,b,future))
        with torch.inference_mode():
            predictions=predictor.predict_batch(dfs,xs,ys,pred_len=steps,sample_count=1,verbose=False)
        for index,(r,b,future) in enumerate(meta):
            paths=np.array([predictions[index*samples+i]['close'].to_numpy() for i in range(samples)])
            valid=bool(np.isfinite(paths).all() and (paths>0).all())
            item={'symbol':r['symbol'],'market':r['market'],'venue':'BITGET','tf':'15m','inputAsOf':int(b[-1,0]+900000),'inputBars':len(b),'inputHash':hashlib.sha256(b.tobytes()).hexdigest(),'referenceClose':float(b[-1,4]),'generatedAt':int(time.time()*1000),'validUntil':int(pd.Timestamp(future.iloc[-1],tz='UTC').timestamp()*1000+900000),'status':'OK' if valid else 'SALIDA_NO_VALIDA','points':[]}
            if valid:
                for i,stamp in enumerate(future):item['points'].append({'time':int(pd.Timestamp(stamp,tz='UTC').timestamp()*1000),'mean':float(paths[:,i].mean()),'low':float(paths[:,i].min()),'high':float(paths[:,i].max())})
                item['projectedReturnPct']=(item['points'][-1]['mean']/item['referenceClose']-1)*100
            output['items'].append(item)
        output['generatedAt']=int(time.time()*1000);output['elapsedSeconds']=time.time()-started
        Path(output_path).write_text(json.dumps(output,allow_nan=False,ensure_ascii=False))
        print(json.dumps({'done':len(output['items']),'total':len(rows),'elapsed':round(output['elapsedSeconds'],2)}),flush=True)
    return output

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);parser.add_argument('--symbols');parser.add_argument('--steps',type=int,default=16);parser.add_argument('--samples',type=int,default=3)
    args=parser.parse_args()
    infer(args.input,args.output,set(args.symbols.split(',')) if args.symbols else None,args.steps,args.samples)
