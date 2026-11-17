import sys,json,os,hashlib,base64,tempfile
q=json.load(sys.stdin); root=os.path.realpath(os.path.expanduser(q['root']))
if not os.path.isdir(root): raise Exception('Remote root is not a directory')
def target(rel):
 p=os.path.abspath(os.path.join(root,rel))
 if os.path.commonpath([root,p])!=root: raise Exception('Unsafe path')
 cur=root
 for part in os.path.relpath(p,root).split(os.sep):
  cur=os.path.join(cur,part)
  if os.path.islink(cur): raise Exception('Symlinks are not supported')
 return p
op=q['op']
if op=='browse':
 print(json.dumps({'path':root,'directories':sorted([e.name for e in os.scandir(root) if e.is_dir(follow_symlinks=False)])}))
elif op=='scan':
 out={}
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if not os.path.islink(os.path.join(base,d))]
  for name in dirs+files:
   p=os.path.join(base,name)
   if os.path.islink(p) or not (os.path.isfile(p) or os.path.isdir(p)): continue
   s=os.stat(p); item={'type':'dir' if os.path.isdir(p) else 'file','size':s.st_size,'mtime':int(s.st_mtime)}
   if item['type']=='file':
    h=hashlib.md5()
    with open(p,'rb') as f:
     for block in iter(lambda:f.read(1048576),b''): h.update(block)
    item['hash']=h.hexdigest()
   out[os.path.relpath(p,root).replace(os.sep,'/')]=item
 print(json.dumps(out))
elif op=='read':
 with open(target(q['path']),'rb') as f: print(json.dumps(base64.b64encode(f.read()).decode()))
elif op=='write':
 p=target(q['path']); os.makedirs(os.path.dirname(p),exist_ok=True)
 fd,tmp=tempfile.mkstemp(dir=os.path.dirname(p))
 try:
  with os.fdopen(fd,'wb') as f: f.write(base64.b64decode(q['data']))
  os.utime(tmp,(q['mtime'],q['mtime'])); os.replace(tmp,p)
 finally:
  if os.path.exists(tmp): os.unlink(tmp)
 print('null')
elif op=='mkdir':
 os.makedirs(target(q['path']),exist_ok=True); print('null')
