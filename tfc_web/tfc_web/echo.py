def application(environ, start_response):
    status = '200 OK'
    output = b'Successful return from https: /test/'

    response_headers = [
                        ('Content-Length', str(len(output)))]

    start_response(status, [('Content-type', 'text/plain')])

    return [output]
