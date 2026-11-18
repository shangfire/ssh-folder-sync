import base64
import hashlib
import json
import os
import sys
import tempfile

request = json.load(sys.stdin)
root = os.path.realpath(os.path.expanduser(request['root']))
if not os.path.isdir(root):
    raise Exception('Remote root is not a directory')


def signature(stat):
    return ':'.join(str(value) for value in (
        stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_ino
    ))


def target(relative):
    destination = os.path.abspath(os.path.join(root, relative))
    if os.path.commonpath([root, destination]) != root:
        raise Exception('Unsafe path')
    current = root
    for part in os.path.relpath(destination, root).split(os.sep):
        current = os.path.join(current, part)
        if os.path.islink(current):
            raise Exception('Symlinks are not supported')
    return destination


operation = request['op']
if operation == 'browse':
    drives = []
    if os.name == 'nt':
        import ctypes
        mask = ctypes.windll.kernel32.GetLogicalDrives()
        drives = [chr(65 + i) + ':' + os.sep for i in range(26) if mask & (1 << i)]
    directories = sorted(
        entry.name for entry in os.scandir(root)
        if entry.is_dir(follow_symlinks=False)
    )
    print(json.dumps({'path': root, 'drives': drives, 'directories': directories}))
elif operation == 'scan':
    result = {}
    cache = request.get('cache', {})
    for base, directories, files in os.walk(root, followlinks=False):
        directories[:] = [
            name for name in directories
            if not os.path.islink(os.path.join(base, name))
        ]
        for name in directories + files:
            filename = os.path.join(base, name)
            if os.path.islink(filename):
                continue
            if not (os.path.isfile(filename) or os.path.isdir(filename)):
                continue
            stat = os.stat(filename)
            relative = os.path.relpath(filename, root).replace(os.sep, '/')
            item = {
                'type': 'dir' if os.path.isdir(filename) else 'file',
                'size': stat.st_size,
                'mtime': int(stat.st_mtime),
                'signature': signature(stat),
            }
            previous = cache.get(relative, {})
            if item['type'] == 'file':
                cached_hash = previous.get('hash', '')
                if (previous.get('signature') == item['signature']
                        and len(cached_hash) == 32
                        and all(c in '0123456789abcdef' for c in cached_hash)):
                    item['hash'] = cached_hash
                else:
                    digest = hashlib.md5()
                    with open(filename, 'rb') as stream:
                        for block in iter(lambda: stream.read(1048576), b''):
                            digest.update(block)
                    if signature(os.stat(filename)) != item['signature']:
                        raise Exception('File changed during comparison: ' + filename)
                    item['hash'] = digest.hexdigest()
            result[relative] = item
    print(json.dumps(result))
elif operation == 'read':
    with open(target(request['path']), 'rb') as stream:
        print(json.dumps(base64.b64encode(stream.read()).decode()))
elif operation == 'write':
    destination = target(request['path'])
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=os.path.dirname(destination))
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(base64.b64decode(request['data']))
        os.utime(temporary, (request['mtime'], request['mtime']))
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('null')
elif operation == 'mkdir':
    os.makedirs(target(request['path']), exist_ok=True)
    print('null')
