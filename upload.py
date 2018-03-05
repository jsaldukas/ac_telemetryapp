import http.client, os, os.path
    
def main():
    if not os.path.isdir('archive'):
        os.mkdir('archive')
        
    for file in os.listdir('.'):
        if file.endswith('.csv'):
            print('Uploading ' + file)
            input("PRESS ENTER TO CONTINUE.")
            uploadLap(file)
    
def uploadLap(file):
    conn = http.client.HTTPConnection("185.205.210.150:14215")
    
    with open(file, 'r') as f:
        data = f.read()
    
    headers = { 
        'Authorization' : 'Custom justinas:12',
        'Content-Type' : 'text/plain'
    }
    
    conn.request("POST", "/lap/" + file, data, headers)
    response = conn.getresponse()
    
    if response.status != 200:
        raise Exception('Upload failed, HTTP ' + str(response.status))
    
    #os.rename(file, archive + '/' + file)
    print('Uploaded ' + file)
    
main()