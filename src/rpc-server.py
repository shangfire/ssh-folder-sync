import base64
import io
import json
import sys

operation_source = base64.b64decode('SCRIPT_BASE64').decode('utf-8-sig')
transport_input = sys.stdin
transport_output = sys.stdout
for line in transport_input:
    try:
        request = json.loads(line)
        captured = io.StringIO()
        try:
            sys.stdin = io.StringIO(json.dumps(request))
            sys.stdout = captured
            exec(compile(operation_source, '<ssh-folder-sync>', 'exec'), {})
        finally:
            sys.stdin = transport_input
            sys.stdout = transport_output
        response = {'result': json.loads(captured.getvalue())}
    except Exception as error:
        response = {'error': str(error)}
    transport_output.write(json.dumps(response) + '\n')
    transport_output.flush()
