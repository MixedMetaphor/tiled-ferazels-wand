function fwRead(filename: string): TileMap {
  let f = new TextFile(filename);
  let data = JSON.parse(f.readAll());

  // not great
  let dirname = filename.replace(/\/[^/]+$/, "/");
  let worldData = dirname.concat('../../');

  let tm = new TileMap();
  tm.setSize(data.mainTileMapSizeH, data.mainTileMapSizeV);
  tm.setTileSize(32, 32);
  tm.setProperty('Level name', data.levelName);
  tm.setProperty('Music track', data.music);

  let loopTileMapLayer: ((layer: TileLayer, tilemap: [number], [tileMapSizeH, tileMapSizeV]: [number, number], callback: (t: number, e: number) => Tile | null) => void) = (layer, tilemap, [tileMapSizeH, tileMapSizeV], callback) => {
    let edit = layer.edit();
    tilemap.forEach((t, e) => {
      let tile = callback(t, e);
      if (tile === null) {
        return;
      }
      let x = e % tileMapSizeH;
      let y = Math.floor(e / tileMapSizeH);
      edit.setTile(x, y, tile);
    });
    edit.apply();
  };

  let mainTileMapSize = [data.mainTileMapSizeH, data.mainTileMapSizeV]
  let bg = new Tileset("Background");
  bg.setTileSize(32, 32);
  bg.imageFileName = worldData.concat(`sprites/${data.bgTilesetID}.png`);
  data.bgTileDefs.forEach((d, e) => {
    bg.tile(e).setProperty('Tiledef', d);
  });
  tm.addTileset(bg);

  let bgl = new TileLayer("Background");
  loopTileMapLayer(bgl, data.bgTileMap, mainTileMapSize, (t) => {
    let bgt = t & 0xff;
    return bgt == 0? null : bg.tile(bgt - 1);
  });
  tm.addLayer(bgl);

  let fg = new Tileset("Foreground");
  fg.setTileSize(32, 32);
  fg.imageFileName = worldData.concat(`sprites/${data.fgTilesetID}.png`);
  data.fgTileDefs.forEach((d, e) => {
    fg.tile(e).setProperty('Tiledef', d);
  });
  tm.addTileset(fg);

  let fgl = new TileLayer("Foreground");
  loopTileMapLayer(fgl, data.fgTileMap, mainTileMapSize, (t) => {
    let fgt = t & 0xff;
    return fgt == 0? null : fg.tile(fgt - 1);
  });
  tm.addLayer(fgl);

  var fgo: Tileset;
  if (data.fgOverlayTilesetID != 0 && data.fgOverlayTilesetID != data.fgTilesetID) {
    fgo = new Tileset("Foreground overlay");
    fgo.setTileSize(32, 32);
    fgo.imageFileName = worldData.concat(`sprites/${data.fgOverlayTilesetID}.png`);
    tm.addTileset(fgo);
  } else {
    fgo = fg;
  }

  let fgol = new TileLayer("Foreground overlay");
  loopTileMapLayer(fgol, data.fgOverlayTileMap, mainTileMapSize, (t) => {
    let fgt = t >> 8;
    return fgt == 0? null : fgo.tile(fgt - 1);
  });

  if (data.fgPatternTilesetID != 0) {
    let fgp = new Tileset("Foreground pattern");
    fgp.setTileSize(32, 32);
    fgp.imageFileName = worldData.concat(`sprites/${data.fgPatternTilesetID}.png`);
    tm.addTileset(fgp);
    let fgpl = new TileLayer("Foreground pattern");
    loopTileMapLayer(fgpl, data.fgTileMap, mainTileMapSize, (t, e) => {
      let fgt = t & 0xff;
      return fgt == 96? fgp.tile(e % 36) : null;
    });
    tm.addLayer(fgpl);
    tm.addLayer(fgol);

    let fgopl = new TileLayer("Foreground overlay pattern");
    loopTileMapLayer(fgopl, data.fgOverlayTileMap, mainTileMapSize, (t, e) => {
      let fgt = t >> 8;
      return fgt == 96? fgp.tile(e % 36) : null;
    });
    tm.addLayer(fgopl);
  } else {
    tm.addLayer(fgol);
  }

  return tm;
}

tiled.registerMapFormat("Ferazel's Wand", {
  extension: "json",
  name: "Ferazel's Wand level data",
  read: fwRead,
});
