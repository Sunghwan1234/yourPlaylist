<h1>Save and Play YouTube Playlists</h1>
<p>This website displays YouTube Playlists without ads, and saves them to be loaded offline.</p>
<h2 style="color: red">This is a Work In Progress!</h2>
<p>This website is me learning javascript. It will not be efficient, or have every feature.</p>
<p>I'm welcome to accepting your suggestions and help, though!</p>

<h2>This website uses:</h2>
<ul>
  <li>Inviduous, Piped, and Cobalt APIs to fetch YouTube data</li>
  <li>Javascript with Fetch API</li>
  <li>LocalStorage and Cache to store data</li>
  <l1>Some AIs helping me learn new code</l1>
</ul>

<h1>devnotes</h1>

Library
fetchWithCatch
  fetchToJson
    fetch

Current Video Loading & Playing Trees
  LoadVideoIndex -> LoadVideo
    loadFullVideo
      getCachedVideo
      loadVideoData (all fetches here)
        (the fetches themselves cache the videos for playback.)
        fetchInvidiousVideo
        fetchPipedVideo
        fetchCobaltVideo
        returns passVideoData
      returns passFullVideo
    loadPlayer
    (tries forceloading)

Goal Trees
  LoadVideoIndex -> LoadVideo
    (Handles getting saved videoData from cache and localStorage)
    fetchVideo
      fetch*method*Video
        (handles fetch)
        (handles cache & playback integrated maybe)
      returns passFullVideo (contains both video urls and data)

