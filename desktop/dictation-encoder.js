"use strict";
// Encoding runs outside the main Electron thread. No audio is written to disk.
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
    const { Mp3Encoder } = await import("@breezystack/lamejs");
    const pcm = new Int16Array(workerData);
    const encoder = new Mp3Encoder(1, 16000, 64), parts = [];
    for (let offset = 0; offset < pcm.length; offset += 1152) {
        parts.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(offset, offset + 1152))));
    }
    parts.push(Buffer.from(encoder.flush()));
    parentPort.postMessage(Buffer.concat(parts));
})().catch(error => { throw error; });
