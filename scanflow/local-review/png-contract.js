// Bounded worker PNG contract, not a claim that the pixels belong to a page.
// 8-bit RGB/RGBA, non-interlaced. One bounded pHYs chunk is accepted and ignored;
// physical page dimensions always come from the original, never this metadata.
const fail=()=>{throw new Error('image_invalid');};
const crcTable=Array.from({length:256},(_,i)=>{
  let c=i;for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
export function crc32(bytes) {
  let c=0xffffffff;for(const n of bytes)c=crcTable[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0;
}
export async function inspectPagePng(bytes) {
  if(!(bytes instanceof Uint8Array) || bytes.length<57 || bytes.length>20*1024*1024
    || ![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) fail();
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=8,width,height,channels,count=0,ended=false,physicalMetadata=false;const compressed=[];
  while(offset<bytes.length) {
    if(++count>4096 || offset+12>bytes.length) fail();
    const size=v.getUint32(offset),end=offset+12+size;
    if(end>bytes.length) fail();
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(crc32(bytes.subarray(offset+4,end-4))!==v.getUint32(end-4)) fail();
    if(type==='IHDR') {
      if(count!==1 || size!==13) fail();
      width=v.getUint32(offset+8);height=v.getUint32(offset+12);
      const color=bytes[offset+17];channels=color===0?1:color===2?3:color===6?4:0;
      if(!width || !height || width>100000 || height>100000 || width*height>40000000
        || bytes[offset+16]!==8 || !channels || bytes[offset+18] || bytes[offset+19] || bytes[offset+20]) fail();
    } else if(type==='pHYs') {
      // PNG standard: exactly two uint32 densities and one unit byte, before
      // IDAT. No duplicate, orientation, text, profile or arbitrary payload.
      if(!width || physicalMetadata || compressed.length || ended || size!==9
        || bytes[offset+16]>1)fail();
      physicalMetadata=true;
    } else if(type==='IDAT') {
      if(!width || ended || !size) fail();compressed.push(bytes.subarray(offset+8,end-4));
    } else if(type==='IEND') {
      if(size!==0 || !compressed.length || end!==bytes.length) fail();ended=true;
    } else fail(); // no APNG, palette, embedded orientation or extra payload
    offset=end;
  }
  if(!ended) fail();
  const row=1+width*channels,expected=row*height;
  let decoded=0;let reader;
  try {
    // Stream decoded rows: never allocate the up-to-160MB full raster in Edge.
    reader=new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      if(decoded+value.length>expected) fail();
      let i=(row-decoded%row)%row;
      for(;i<value.length;i+=row) if(value[i]>4)fail();
      decoded+=value.length;
    }
    if(decoded!==expected) fail();
  } catch {fail();}
  finally {if(reader){try{await reader.cancel();}catch{}reader.releaseLock();}}
  return {width,height};
}
