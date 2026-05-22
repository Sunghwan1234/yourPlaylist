const playlistContainer = document.getElementById("playlistContainer");
const playlistElement = document.getElementById("playlist");
const togglePlaylistContainerButton = document.getElementById("togglePlaylistContainer");

const videoPlayer = document.getElementById("video");
const audioPlayer = new Audio();
audioPlayer.preload = "auto";

const thumbnail = document.getElementById("thumbnail");

const settingsPanel = document.getElementById("s_settingsPanel");

const INVIDIOUS_INSTANCES = [
    "inv.nadeko.net", // Endpoint Disabled
    "yt.chocolatemoo53.com",
    // "invidious.nerdvpn.de", // Auth required
    // "yewtu.be", // Is a frontend
    "inv.thepixora.com",
];
const INVIDIOUS_API_INSTANCES = [
    //"inv.thepixora.com"
];
const wrapInvidious = (domain,vId)=>{return `https://${domain}/api/v1/videos/${vId}`;}
/**
 * Nothing is working btw
 * https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md
 * https://github.com/TeamPiped/Piped/wiki/Instances/408b500c3e205e95a197d42b33345c1f207ba62b
 * https://awsmfoss.com/piped/
 */
const PIPED_API_INSTANCES = [
    //"pipedapi.kavin.rocks", // 526 CORS
    //"api.piped.private.coffee", // 500
    //"pipedapi.leptons.xyz", // 502 BAD GATEWAY CORS
    //"pipedapi-libre.kavin.rocks", // 502 BAD GATEWAY
    //"pipedapi.orangenet.cc", // Frontend
    //"piped.syncpundit.io",
    //"nuv3d-7iaaa-aaaan-qahma-cai.ic0.app", // Frontend
];
const wrapPiped=(domain,vId)=>{return `https://${domain}/streams/${vId}`;}
/**
 * https://github.com/imputnet/cobalt
 * https://cobalt.directory/
 * API: https://cobalt.directory/api/working?type=api
 */
const COBALT_DIRECTORY = "https://cobalt.directory/api/working?type=api";
let COBALT_INSTANCES = [];
async function fetchCobaltDirectory() {
    console.log("Fetching Cobalt Directory...");
    const response = await fetchWithCatch(COBALT_DIRECTORY);
    if (response) {
        COBALT_INSTANCES = response.data.youtube;
        console.log(COBALT_INSTANCES);
    }
}
/**
 * https://www.whateverorigin.org/
 * https://allorigins.win/
 * https://cors.lol/#getStarted
 * https://github.com/Eiledon/alloworigin
 */
const CORS_PROXIES = [
    //"corsproxy.io/?url=",
    //"proxy.corsfix.com/?", // Must signup
    //"api.allorigins.win/raw?url=", // slow
    //"whateverorigin.org/get?url=", // 20r/s 500(ServerError)
    "api.cors.lol/?url=", // FileLimit20mb and slow
    //"alloworigin.com/get?url=", // Failing
];
function addCors_Proxy(cors_proxy, url) {
    return `https://${cors_proxy}${encodeURIComponent(url)}`;
}

let temp_playlistAddress = "PLXPg0M1hQSff6jP8XGSDSsyf4lDdTfOXT";

let playlist; // PlaylistData
let currentVideo; // VideoData
let currentVideoIndex=0;
let backgroundPlaybackStatus = false;
let unsynced = false;

// BEFORE INIT
navigator.storage.persist();
/**
 * 
 * @param {string} videoUrl 
 * @param {string} audioUrl 
 * @param {object} videoData 
 * @param {object} playlistVData 
 * @returns fullVideo
 */
const passFullVideo = (videoUrl, audioUrl=null, videoData=null, playlistVData=null) => {
    const title = videoData?.title || playlistVData?.title || 'title not found';
    const author = videoData?.author || playlistVData?.author || 'author not found';
    return {
        videoUrl: videoUrl,
        audioUrl: audioUrl,
        videoData: videoData,
        playlistVData: playlistVData,
        title: title,
        author: author,
    }
}

function getLocalBoolean(setting) {
    return localStorage.getItem("s_"+setting)=='true';
}
async function cacheVideo(videoId, videoUrl=null, audioUrl=null) {
    if (audioUrl) {
        const audioCache = await caches.open("cached-audios");
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {return;}
        await audioCache.put(videoId, audioResponse.clone());
    }
    if (videoUrl) {
        const cache = await caches.open("cached-videos");
        const response = await fetch(videoUrl);
        if (!response.ok) {return;}
        await cache.put(videoId, response.clone());
    }
}
async function getCachedVideo(videoId) {
    const cache = await caches.open("cached-videos");
    const data = await cache.match(videoId);
    if (!await validateMedia(data)) {
        return null;
    } else {
        return data;
    }
}
async function getCachedAduio(videoId) {
    const cache = await caches.open("cached-audios");
    return await cache.match(videoId);
}

async function validateMedia(url) {
    const res = await fetch(url);
    const blob = await res.blob();

    console.log("valMed: Stream size:", blob.size);

    if (!res.ok || blob.size < 50000) {
        // anything tiny is likely broken
        return null;
    }

    return blob;
}
/**
 * fetch but with a catch and abort.
 * @param {*} targetUrl 
 * @param {*} method 
 * @returns json response
 */
async function fetchWithCatch(targetUrl, method={}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(),10*1000);
    try {
        method.signal = controller.signal;
        //console.log("Method",method);
        const response = await fetch(targetUrl, method).catch(() => null);
        if (response && response.ok) {
            return await response.json();
        }
    } catch (error) {
        if (error.name=='AbortError') {
            console.warn("Timed out (10s)");
            return null;
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
/**
 * https://docs.invidious.io/api/#get-apiv1playlistsplid
 * This should be enough for all uses, except the thumbnail inside videoData
 * @param {*} playlistId 
 * @returns 
 */
async function fetchPlaylistData(playlistId) {
    for (let domain of INVIDIOUS_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/playlists/${playlistId}`;
        console.log(`Polling server path: ${targetUrl}`);

        const data = await fetchWithCatch(targetUrl);
        if (!data) {continue;}
        if (!data.videos || !Array.isArray(data.videos)) {
            console.warn(`${domain} returned data, but 'videos' array was missing.`);
            continue;
        }
        //console.log(data);
        const videoData = data.videos.map(video => {
            const videoThumbnails = video.videoThumbnails.map(thumbnail => {
                let newThumbnail = thumbnail;
                newThumbnail.url = `https://${domain}${thumbnail.url || ''}`;
                return newThumbnail;
            });
            return {
                id: video.videoId,
                title: video.title,
                author: video.author,
                index: video.index,
                length: video.lengthSeconds,
                thumbnail: videoThumbnails[0].url,
                thumbnails: videoThumbnails,
            };
        });
        const playlistData = {
            id: data.playlistId,
            title: data.title,
            author: data.author,
            authorThumbnail: '',
            description: data.description,
            videos: videoData,
        };
        console.log(`Successfully imported ${videoData.length} videos from ${domain}`);
        console.log(playlistData);
        return playlistData;
    }

    console.error("All Invidious API instances failed.");
    return null;
}
async function fetchVideo(videoId, proxy=null) {
    for (const domain of INVIDIOUS_API_INSTANCES) {
        console.log("Fetching Domain",domain);
        let targetUrl = wrapInvidious(domain,videoId);
        if (proxy) {targetUrl=addCors_Proxy(proxy,targetUrl);}
        const data = await fetchWithCatch(targetUrl);
        if (data) {return parseVideoData(data, "invidious",videoId);}
    }
    return null;
}
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
 * https://github.com/imputnet/cobalt/blob/main/docs/api.md
 * @param {*} videoId 
 * @param {*} proxy 
 * @returns the json return
 */
async function fetchCobaltVideo(videoId, proxy=null) {
    for (const domain of COBALT_INSTANCES) {
        const data = await fetchWithCatch(domain, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: `https://youtube.com/watch?v=${videoId}`,
            })
        });
        if (!data || data.status === "error") {continue;}
        if (!data.url) {continue;}
        if (!await validateMedia(data.url)) {
            console.warn("Domain",domain,"url is null");
            continue;
        }
        return data;
    }
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
/**
 * handles all fetch operations,
 * @param {string} videoId 
 * @param {object} videoData
 * @param {object} playlistVData
 */
async function loadVideoData(videoId, playlistVData={}) {
    console.log("LVD: Fetching",videoId);
    let pipeline="invidious";
    let video = await fetchVideo(videoId);
    if (!video) {
        console.log("LVD: Trying Proxies...");
        video = await fetchProxiedVideo(videoId);
        if (!video) {
            console.log("LVD: Trying Cobalt...");
            pipeline = "cobalt";
            video = await fetchCobaltVideo(videoId);
            if (!video) {
                console.error("LVD: All attempts to load Video Data failed.");
                return null;
            }
        }
    }
    console.log("LVD: Loaded from",pipeline,":",video)
    if (pipeline=="cobalt") {
        if (!playlistVData) {playlistVData = {};}
        playlistVData.pipeline = "cobalt";
        return passFullVideo(video.url,null,playlistVData,playlistVData);
    } else {
        const formats = { // +1 for webm
            r144p: 0, r240p: 2, r360p: 4, r480p: 8,
            r720p: 10, r1080p: 12
        }; // TODO: TEST TS
        const videoUrl = video.videoStreams[formats.r480p+1].url; // 480p
        const audioUrl = video.audioStreams[3].url;
        return passFullVideo(videoUrl, audioUrl, video, playlistVData);
    }
}
/**
 * Loads 
 * @param {String} videoId 
 * @param {boolean} forceLoad 
 * @param {String} forceSaveAsId Enter a URL to overwrite the save
 * @returns 
 */
async function loadFullVideo(videoId, playlistVData, forceLoad, forceSaveAsId=null) {
    console.log('LFV: Loading Video Data of',playlistVData.title,", fl,fs",forceLoad,forceSaveAsId);
    let saved_videoData = null;
    let isVideoCached = false;
    if (!forceLoad) {
        saved_videoData = JSON.parse(localStorage.getItem(videoId));
        if (saved_videoData) {
            const cachedVideo = await getCachedVideo(videoId);
            if (cachedVideo) {
                isVideoCached = true;
                const blob = await cachedVideo.blob();
                const videoUrl = URL.createObjectURL(blob);
                let audioUrl = null;
                if (saved_videoData.pipeline = "cobalt") {
                    
                } else {
                    const cachedAudio = await getCachedAudio(videoId);
                    const blob = await cachedAudio.blob();
                    audioUrl = URL.createObjectURL(blob);
                }
                console.log(`LFD: Found saved videoData:`,saved_videoData);
                console.log(`LFD: Found cached video:`,cachedVideo);
                return passFullVideo(videoUrl, audioUrl, saved_videoData. playlistVData);
            }
        }
    }
    const fullVideo = await loadVideoData(videoId, playlistVData);
    console.log("LFV: Loaded full video:",fullVideo);
    
    if ((!forceLoad && !saved_videoData) || forceSaveAsId) { // maybe () around !saved_video || saveTo
        console.log("LFV: Saving fullVideo:",fullVideo);
        if (forceSaveAsId) {
            console.log("LFV: Overwriting saved video to alternative:",fullVideo.title);
            videoId = forceSaveAsId;
        }
        cacheVideo(videoId, fullVideo.videoUrl, fullVideo.audioUrl);
        localStorage.setItem(videoId, JSON.stringify(fullVideo.videoData || fullVideo.playlistVData));
    } else {
        if (!isVideoCached) {
            console.log("LFV: Caching fullVideo:",fullVideo);
            cacheVideo(videoId, fullVideo.videoUrl, fullVideo.audioUrl);
        }
    }
    return fullVideo;
}
/**
 * loads a video
 * @param {*} videoId 
 * @param {*} forceLoad 
 * @param {*} saveAsId Force Save as Id
 * @returns 
 */
async function loadVideo(videoId, playlistVData, forceLoad=getLocalBoolean('forceLoad'), saveAsId=null) {
    console.log(`LV: Loading Video`,videoId);
    let fullVideo = await loadFullVideo(videoId, playlistVData, forceLoad, saveAsId);
    if (!fullVideo) {return;}
    let videoLoaded = await loadPlayer(fullVideo);
    if (!videoLoaded) {
        if (!forceLoad) {
            console.warn(`LV: Saved Video ${fullVideo.title} failed to load. ForceLoading...`);
            fullVideo = await loadFullVideo(videoId, playlistVData, true, videoId);
            if (!fullVideo) {return;}
            videoLoaded = await loadPlayer(fullVideo);
        }
        if (!videoLoaded) {
            console.warn(`LV: Video ${fullVideo.title} failed to forceload.`);
            return;
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
        }
    }
    currentVideo = fullVideo;
    return true;
}
async function loadVideoIndex(videoIndex, forceLoad=getLocalBoolean('forceLoad'), saveAsId=null) {
    const video = playlist.videos[videoIndex];
    currentVideoIndex = videoIndex;
    return await loadVideo(video.id, video, forceLoad, saveAsId);
}

/**
 * Loads a video into the videoplayer and audioplayer
 * @param {*} fullVideo 
 * @param {*} saveAsId ID to overwrite original
 * @returns {Boolean} Success or not
 */
async function loadPlayer(fullVideo) {
    console.log("LP: Loading fullVideo:",fullVideo);
    const videoUrl = fullVideo.videoUrl;
    const audioUrl = fullVideo.audioUrl;
    const thumbnailUrl = fullVideo.videoData?.thumbnails?.[0]?.url || fullVideo.playlistVData?.thumbnails?.[0]?.url || '';

    videoPlayer.pause();
    videoPlayer.hidden = getLocalBoolean('useThumbnail');
    audioPlayer.currentTime = 0;
    audioPlayer.src = audioUrl;

    const blob = await validateMedia(videoUrl);
    if (!blob) {
        console.warn("LP: Blob is null");
        return false;
    }

    const successfulLoad = await loadVideoPlayer(fullVideo);
    if (getLocalBoolean('useThumbnail') || document.hidden) {
        if (audioUrl) {
            audioPlayer.play().then(() => updateMediaSession(videoData));
        }
        if (document.hidden) {
            videoPlayer.src = URL.createObjectURL(blob);
            console.warn("Started playing audio while hidden!");
            return true;
        }
    } else {
        const videoPlayed = await playVideoPlayer();
        if (!videoPlayed) {return false;}
    }

    document.body.style.background = "black";

    console.log("Loading was successful!");
    return true;
}

async function loadVideoPlayer(fullVideo) {
    document.getElementById("video_name").textContent = fullVideo.title;
    document.getElementById("video_author").textContent = fullVideo.author;

    if (getLocalBoolean('useThumbnail')) {
        thumbnail.src = fullVideo.videoData.thumbnails[0].url;
    } else {
        console.log("loadVideoPlayer: Loading Video URL:", fullVideo.videoUrl);
        const blob = await validateMedia(videoUrl);
        videoPlayer.src = URL.createObjectURL(blob);
        await videoPlayer.load();
    }
}
async function playVideoPlayer() {
    const videoPlayed = await videoPlayer.play().catch((error) => {
        videoPlayer.pause();
        // Perhaps return a better error
        console.error("videoPlayer Error;",error);
        return "failed";
    });
    return videoPlayed!=="failed";
}

function updateMediaSession(fullVideo) {
    if ('mediaSession' in navigator) {
        if (fullVideo) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: fullVideo.title,
                artist: fullVideo.author,
                album: ''
            });
        }

        // Map lock-screen controls so system actions don't break execution
        navigator.mediaSession.setActionHandler('play', () => videoPlayer.play());
        navigator.mediaSession.setActionHandler('pause', () => videoPlayer.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => track(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => track(-1));
    }
}
async function track(offset) {
    return await loadVideoIndex(currentVideoIndex+offset);
}
// UI
function showPlaylist() {
    const videoData = playlist.videos;
    console.log("Playlist Videos returned:",playlist);
    if (videoData.length == 0) {
        playlistElement.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
        return;
    }
    for (let video of videoData) {
        const videoItem = `
            <div class='video' id='${video.id}'>
                <img src='${video.thumbnail}' alt='${video.title}'>
                <div class='video_details'>
                    <p class='video_title'>${video.title}</p>
                    <p class='video_author'>${video.author}</p>
                </div>
            </div>
        `;
        playlistElement.insertAdjacentHTML('beforeend', videoItem);
    }
    playlistElement.addEventListener('click',function(event) {
        const videoItem = event.target.closest('.video');
        if (!videoItem) {return;}
        const videoId = videoItem.id;
        const videoIndex = playlist.videos.findIndex(video => video.id==videoId);
        loadVideoIndex(videoIndex, getLocalBoolean('forceLoad'), getLocalBoolean("forceSave")?videoId:null);
    });

    document.getElementById("playlist_name").textContent = playlist.title;
}
function togglePlaylistContainer() {
    if (togglePlaylistContainerButton.classList.contains("showPlaylistContainer")) {
        playlistContainer.classList.remove("hiddenPlaylistContainer");
        togglePlaylistContainerButton.classList.remove("showPlaylistContainer");
        togglePlaylistContainerButton.textContent = "Hide";
    } else {
        playlistContainer.classList.add("hiddenPlaylistContainer");
        togglePlaylistContainerButton.classList.add("showPlaylistContainer");
        togglePlaylistContainerButton.textContent = "Show Playlist";
    }
}

function savePlaylist() {
    localStorage.setItem('playlist', JSON.stringify(playlist));
    console.log("Saved Playlist!");
}

async function init() {
    const saved_playlist = JSON.parse(localStorage.getItem('playlist'));
    if (saved_playlist && saved_playlist.videos.length>0 && !getLocalBoolean('forceLoad')) {
        console.log("Loaded saved playlist!");
        playlist = saved_playlist;
    } else {
        //console.log("Saved Playlist: "+saved_playlist);
        playlist = await fetchPlaylistData(temp_playlistAddress);
        savePlaylist();
    }
    showPlaylist();
}

function checkAllInstances() {
    for (let domain of BACKEND_MIRRORS) {
        fetch(`https://${domain}/api/v1/stats`)
        .then((response) => {return response.json();})
        .then((data) => {console.log(domain,data);});
    }
}

let isSeeking = false;

async function initVideoEventListeners() {
    videoPlayer.addEventListener('play', () => {
        console.log("play");
        if (backgroundPlaybackStatus) {
            setTimeout(() => {
            backgroundPlaybackStatus = false;
            },100);
        } else {
            if (audioPlayer.src && audioPlayer.paused) {
                videoPlayer.currentTime = audioPlayer.currentTime;
                audioPlayer.play().then(()=>{updateMediaSession(currentVideo)});
                audioPlayer.muted = false;
            }
        }
    });
    videoPlayer.addEventListener('pause', () => {
        console.log("pause");
        if (document.hidden) {
            backgroundPlaybackStatus = true;
        } else {
            updateMediaSession(currentVideo);
            if (audioPlayer.src) {
                audioPlayer.pause()
            
                audioPlayer.muted = true;
            }
        }
    });

    videoPlayer.addEventListener('seeking', () => {
        console.log("seek");
        if (!backgroundPlaybackStatus) {
            isSeeking = true;
            if (audioPlayer.src) {
                audioPlayer.currentTime = videoPlayer.currentTime;
            }
            updateMediaSession(currentVideo);
        }
    });
    videoPlayer.addEventListener('seeked', () => {
        console.log("seeked");
        if (!backgroundPlaybackStatus) {
            updateMediaSession(currentVideo);
            if (audioPlayer.src) {
                audioPlayer.muted = false;
            }
            setTimeout(()=>{isSeeking=false;}, 10);
        }
    });

    audioPlayer.addEventListener('ended', () => {
        videoPlayer.pause();
        if (document.hidden) {
            unsynced = true;
        }
        track(1);
    });
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            if (unsynced) { // video did not load in background?
                if (currentVideo) {
                    await loadVideoPlayer(currentVideo);
                    if (audioPlayer.src) {
                        audioPlayer.muted = true;
                    }
                    videoPlayer.addEventListener('loadedmetadata', function syncOnLoad() {
                        videoPlayer.currentTime = audioPlayer.currentTime;
                        if (audioPlayer.src && !audioPlayer.paused) {
                            audioPlayer.muted = false;
                            playVideoPlayer();
                        }
                        videoPlayer.removeEventListener('loadedmetadata', syncOnLoad);
                    });
                }
                unsynced = false;
            } else if (audioPlayer.src && !audioPlayer.paused) { // Video is loaded
                videoPlayer.currentTime = audioPlayer.currentTime;
            }
        }
    });
}

// Settings
function initBoolSettings() {
    const settings = [
        "useThumbnail",
        "forceLoad",
        "forceSave"
    ]
    for (let setting of settings) {
        $(`#s_${setting}`).prop("checked", getLocalBoolean(setting));
        $(`#s_${setting}`).change(function(){
            if ($(this).is(':checked')) {
                localStorage.setItem(`s_${setting}`, 'true');
            } else {
                localStorage.setItem(`s_${setting}`, 'false');
            }
        });
    }
}

function toggleSettingsPanel() {settingsPanel.hidden = !settingsPanel.hidden;}
// Init
initBoolSettings();
init();
initVideoEventListeners();
// Run anything else here
fetchCobaltDirectory();