/* Copyright (C) 2025 Esteban Torre */

const uWS = require('uWebSockets.js');
const fs = require('fs');

const port = 9009; // power level

let openStreams = 0;
let streamIndex = 0;


/* Helper function converting Node.js buffer to ArrayBuffer */
function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/* Either onAborted or simply finished request */
function onAbortedOrFinishedResponse(res, readStream) {
  readStream.destroy();
}

/* Helper function to pipe the ReadaleStream over an Http responses */
function pipeStreamOverResponse(res, readStream, totalSize) {
  readStream.on('data', (chunk) => {
    const ab = toArrayBuffer(chunk);

    let lastOffset = res.getWriteOffset();
    res.cork(()=>{
      let [ok, done] = res.tryEnd(ab, totalSize);

      if (done) {
        onAbortedOrFinishedResponse(res, readStream);
      } else if (!ok) {
        readStream.pause();

        /* Save unsent chunk for when we can send it */
        res.ab = ab;
        res.abOffset = lastOffset;

        /* Register async handlers for drainage */
        res.onWritable((offset) => {
          /* Here the timeout is off, we can spend as much time before calling tryEnd we want to */

          /* On failure the timeout will start */
          let [ok, done] = res.tryEnd(res.ab.slice(offset - res.abOffset), totalSize);
          if (done) {
            onAbortedOrFinishedResponse(res, readStream);
          } else if (ok) {
            /* We sent a chunk and it was not the last one, so let's resume reading.
            * Timeout is still disabled, so we can spend any amount of time waiting
            * for more chunks to send. */
            readStream.resume();
          }

          /* We always have to return true/false in onWritable.
          * If you did not send anything, return true for success. */
          return ok;
        });
      }
    });

  }).on('error', () => {
    /* Todo: handle errors of the stream, probably good to simply close the response */
    console.log('Unhandled read error from Node.js, you need to handle this!');
  });

  /* If you plan to asyncronously respond later on, you MUST listen to onAborted BEFORE returning */
  res.onAborted(() => {
    onAbortedOrFinishedResponse(res, readStream);
  });
}

/* Yes, you can easily swap to SSL streaming by uncommenting here */
const app = uWS./*SSL*/App({
  key_file_name: 'misc/key.pem',
  cert_file_name: 'misc/cert.pem',
  passphrase: '1234'
}).get('/', (res,req) => {
  const fileName = 'public/index.html';
  const totalSize = fs.statSync(fileName).size;
  const readStream = fs.createReadStream(fileName);
  pipeStreamOverResponse(res, readStream, totalSize);
}).get('/file/:hash', (res, req) => {
  /* Log */
  //console.time(res.id = ++streamIndex);
  //console.log('Stream was opened, openStreams: ' + ++openStreams);
  /* Create read stream with Node.js and start streaming over Http */
  console.log(req.getParameter('hash'));
  //const readStream = fs.createReadStream(fileName);
  //pipeStreamOverResponse(res, readStream, totalSize);
}).ws('/ws',{
  idleTimeout: 12,
  open: (ws) => {

  },
  message: (ws, message, isBinary) => {
    const data = JSON.parse(Buffer.from(message).toString('utf-8'));
    console.log(JSON.stringify(data));
    ws.cork(()=>{
      ws.send("{}",false);
    })
  },
  drain: (ws) => {
    
  },
  close: (ws, code, message) => {

  }
}).get('/*', (res, req) => {
  /* Make sure to always handle every route */
  res.end('Nothing to see here!');
}).listen(port, (token) => {
  if (token) {
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});
