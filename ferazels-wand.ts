function fwRead(filename: string): TileMap {
  let f = new TextFile(filename);
  let data = JSON.parse(f.readAll());

  let tm = new TileMap();
  tm.setProperty('Level name', data.levelName);
  tm.setProperty('Music track', data.music);
  return tm;
}

tiled.registerMapFormat("Ferazel's Wand", {
  extension: "json",
  name: "Ferazel's Wand level data",
  read: fwRead,
});
