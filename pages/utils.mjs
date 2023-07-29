/**
 * @param {URL | RequestInfo} input 
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchGzip(input) {
    const ds = new DecompressionStream('gzip');
    const response = await fetch(input);
    const blob = await response.blob();
    return await new Response(blob.stream().pipeThrough(ds)).arrayBuffer()
}