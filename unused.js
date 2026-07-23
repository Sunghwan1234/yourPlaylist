/**
 * Nothing is working btw
 * https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md
 * https://github.com/TeamPiped/Piped/wiki/Instances/408b500c3e205e95a197d42b33345c1f207ba62b
 * https://awsmfoss.com/piped/
 */
let PIPED_API_INSTANCES = [];
async function fetchPipedInstances() {
    console.log("Fetching Piped Directory...");
    function s(body) {
        const lines = body.split("\n");
        lines.map(line => {
            const split = line.split("|");
            PIPED_API_INSTANCES.push(split[1].trim());
        });
    };
    s(`kavin.rocks (Official) | https://pipedapi.kavin.rocks | 🇺🇸, 🇮🇳, 🇳🇱, 🇨🇦, 🇬🇧, 🇫🇷 | Yes | ![](https://pipedapi.kavin.rocks/registered/badge)
leptons.xyz | https://pipedapi.leptons.xyz | 🇦🇹 | Yes | ![](https://pipedapi.leptons.xyz/registered/badge)
nosebs.ru | https://pipedapi.nosebs.ru | 🇫🇮 | Yes | ![](https://pipedapi.nosebs.ru/registered/badge)
kavin.rocks libre (Official) | https://pipedapi-libre.kavin.rocks | 🇳🇱 | No | ![](https://pipedapi-libre.kavin.rocks/registered/badge)
privacy.com.de | https://piped-api.privacy.com.de | 🇩🇪 | No | ![](https://piped-api.privacy.com.de/registered/badge)
adminforge.de | https://pipedapi.adminforge.de | 🇩🇪 | No | ![](https://pipedapi.adminforge.de/registered/badge)
piped.yt | https://api.piped.yt | 🇩🇪 | No | ![](https://api.piped.yt/registered/badge)
drgns.space | https://pipedapi.drgns.space | 🇺🇸 | No | ![](https://pipedapi.drgns.space/registered/badge)
owo.si | https://pipedapi.owo.si | 🇩🇪 | No | ![](https://pipedapi.owo.si/registered/badge)
ducks.party | https://pipedapi.ducks.party | 🇳🇱 | No | ![](https://pipedapi.ducks.party/registered/badge)
codespace.cz | https://piped-api.codespace.cz | 🇨🇿 | No | ![](https://piped-api.codespace.cz/registered/badge)
reallyaweso.me | https://pipedapi.reallyaweso.me | 🇩🇪 | No | ![](https://pipedapi.reallyaweso.me/registered/badge)
private.coffee | https://api.piped.private.coffee | 🇦🇹 | No | ![](https://api.piped.private.coffee/registered/badge)
darkness.services | https://pipedapi.darkness.services | 🇺🇸 | No | ![](https://pipedapi.darkness.services/registered/badge)
orangenet.cc | https://pipedapi.orangenet.cc | 🇸🇮 | No | ![](https://pipedapi.orangenet.cc/registered/badge)`);
    console.log("Piped Instances:",PIPED_API_INSTANCES);
}
const wrapPiped=(domain,vId)=>{return `${domain}/streams/${vId}`;}

/**
 * https://www.whateverorigin.org/
 * https://allorigins.win/
 * https://github.com/Freeboard/thingproxy
 * https://codetabs.com/cors-proxy/cors-proxy.html
 * https://cors.lol/#getStarted
 * https://github.com/Eiledon/alloworigin
 */
const CORS_PROXIES = [
    //"corsproxy.io/?url=",
    //"api.codetabs.com/v1/proxy?quest=", // 5r/s 5MB
    //"api.allorigins.win/raw?url=", // slow
    "whateverorigin.org/get?url=", // 20r/s 500(ServerError)
    "api.cors.lol/?url=", // 10MB Per Request
    //"alloworigin.com/get?url=", // Failing
];
function addCors_Proxy(cors_proxy, url) {return `https://${cors_proxy}${encodeURIComponent(url)}`;}

async function fetchPipedVideo(videoId, proxy=null) {
    for (const domain of PIPED_API_INSTANCES) {
        console.log("Fetching Domain",domain);
        let targetUrl = wrapPiped(domain,videoId);
        if (proxy) {targetUrl=addCors_Proxy(proxy,targetUrl);}
        const data = await fetchWithCatch(targetUrl);
        if (data) {return parseVideoData(data, "piped",videoId);}
    }
    return null;
}
async function fetchProxiedVideo(videoId) {
    for (const proxy of CORS_PROXIES) {
        const data = await fetchVideo(videoId, proxy);
        if (data) {return data;}
    }
    return null;
}
async function fetchProxiedPipedVideo(videoId) {
    for (const proxy of CORS_PROXIES) {
        const data = await fetchPipedVideo(videoId, proxy);
        if (data) {return data;}
    }
    return null;
}

/**
 * parses Video Data into one format.
 * https://docs.invidious.io/api/
 * https://docs.piped.video/docs/api-documentation/
 * @param {*} data unfiltered videoData
 * @param {String} pipeline "invidious" or "piped"
 * @param {String} videoId
 * @returns singular object
 */
function parseVideoData(data, pipeline="invidious", videoId) {
    if (pipeline == "invidious") {
        const videoStreams = [];
        const audioStreams = [];
        data.adaptiveFormats.forEach(stream => {
            if (stream.type.includes('video')) {
                const res = stream.resolution.split('x');
                videoStreams.push({
                    index: stream.index,
                    //bitrate: stream.bitrate,codec: stream.encoding,format: null,
                    url: stream.url,
                    mimeType: stream.type, // video/mp4 or audio/webm
                    container: stream.container, // format: mp4, webm
                    //encoding: stream.encoding, // codec, compression method
                    qualityLabel: stream.qualityLabel, // "720p"
                    //resolution: stream.resolution, //1920x1080
                    width: res[0],
                    height: res[1],
                    fps: stream.fps,
                    size: stream.size, // File Size
                    duration: stream.targetDuractionSec,
                });
            } else {
                audioStreams.push({
                    index: stream.index,
                    //bitrate: stream.bitrate,codec: stream.encoding, // codex == encoding methog format: null,
                    url: stream.url,
                    mimeType: stream.type,
                    container: stream.container,
                    //encoding: stream.encoding,
                    duration: stream.targetDurationSec,
                    qualityType: stream.audioQuality, // "AUDIO_QUALITY_LOW"
                    sampleRate: stream.audioSampleRate, // Samples of audio/sec
                    channels: stream.audioChannels // 2 for stereo
                });
            }
        });
        return {
            id: data.videoId,
            title: data.title,
            author: data.author,
            description: data.description,
            published: data.published,
            publishedText: data.publishedText,
            thumbnails: data.videoThumbnails,
            authorThumbnails: data.authorThumbnails,
            length: data.lengthSeconds,
            videoStreams: videoStreams,
            audioStreams: audioStreams,
            formatSteams: data.formatStreams,
            musicTracks: data.musicTracks,
            pipeline: pipeline,
        };
    } else if (pipeline == "piped") {
        const videoStreams = [];
        const audioStreams = [];
        data.videoStreams.forEach((stream, index) => {
            const containerType = stream.mimeType ? stream.mimeType.split('/')[1] : null;
            videoStreams.push({
                index: index, 
                // bitrate: stream.bitrate,codec: stream.codec,format: stream.format,
                url: stream.url,
                mimeType: stream.mimeType, 
                container: containerType, 
                //encoding: stream.codec, 
                qualityLabel: stream.quality, 
                //resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : null, 
                width: stream.width,
                height: stream.height,
                fps: stream.fps,
                size: null, // Requires content-length header or file data
                duration: null, // Requires stream metadata
            });
        });
        data.audioStreams.forEach(stream => {
            audioStreams.push({
                index: stream.index,
                //bitrate: stream.bitrate,codec: stream.encoding, // codex == encoding method
                //format: null,
                url: stream.url,
                mimeType: stream.type,
                container: stream.container,
                //encoding: stream.encoding,
                duration: stream.targetDuractionSec,
                qualityType: stream.audioQuality, // "AUDIO_QUALITY_LOW"
                sampleRate: stream.audioSampleRate, // Samples of audio/sec
                //channels: stream.audioChannels // 2 for stereo
            });
        });
        return {
            id: videoId,
            title: data.title,
            author: data.uploader,
            description: data.description,
            published: null,
            publishedText: data.uploadDate,
            thumbnailUrl: data.thumbnailUrl,
            authorThumbnails: null,
            length: data.duration,
            videoStreams: videoStreams,
            audioStreams: audioStreams,
            formatStreams: null,
            audioStreams: data.audioStreams,
            pipeline: pipeline,
        }
    }
    return null;
}

/**
 * Searched using videoData for the most similar video.
 * @param {*} videoData 
 * @returns video ID of the most similar video
 */
async function searchSimilarVideo(videoData) {
    for (let domain of INVIDIOUS_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/search?`+
        `q=${encodeURIComponent(`${videoData.title} ${videoData.author}`)}`+
        `&type=video`;
        try {
            console.log("searchSimilar Fetching:",targetUrl);
            const response = await fetch(targetUrl).catch((error) => {
                return null;
            });
            if (!response || !response.ok) {
                if (response) {
                    console.warn(`SearchSimilar: Domain ${domain} Resp: `,response);
                }
                continue;
            }
            const data = await response.json();
            console.log(`searchSimilar Data:`,data);

            for (let video of data) {
                if (video.author.includes("Topic")) {
                    continue;
                }
                const authorMatches = videoData.author.includes(video.author) || video.author.includes(videoData.author);
                if (authorMatches) {
                    if (!video.author.includes("Topic")) {
                        console.log("searchSimilar Found:",video);
                        return video.videoId;
                    }
                }
            }
        } catch (e) {
            console.warn("Unknown error:",e);
        }
    }
    console.error("No similar videos found, or domains returned error");
    return null;
}

            // const isConfirmed = confirm("Try searching for similar videos?");

            // if (isConfirmed) {
            //     console.log("Attempting search with video title",fullVideo.title);
            //     const searchResult = await searchSimilarVideo(videoData);
            //     if (searchResult) {
            //         videoLoaded = await loadVideo(searchResult, videoData, true, videoId);
            //         if (!videoLoaded) {
            //             console.error(`loadVideo: All attempts to load ${fullVideo.title} failed.`);
            //             window.alert("All attempts at loading has failed.");
            //             return;
            //         }
            //     } else {
            //         console.error("loadVideo: searchResult returned null.");
            //         return;
            //     }
            // } else {
            //     return;
            // }
            