import json
import os
import sys

for line in sys.stdin:
    try:
        request = json.loads(line)
        root = os.path.realpath(os.path.expanduser(request['directory']))
        if not os.path.isdir(root):
            raise Exception('Remote directory does not exist or is inaccessible: ' + root)
        with os.scandir(root) as entries:
            directories = sorted(
                entry.name for entry in entries
                if entry.is_dir(follow_symlinks=False)
            )
        drives = []
        if os.name == 'nt':
            import ctypes
            mask = ctypes.windll.kernel32.GetLogicalDrives()
            drives = [chr(65 + i) + ':' + os.sep for i in range(26) if mask & (1 << i)]
        response = {'result': {'path': root, 'directories': directories, 'drives': drives}}
    except Exception as error:
        response = {'error': str(error)}
    print(json.dumps(response), flush=True)
