type LevelSpriteData = {
  valid: number;
  kind: number;
  info: number[];
  where: [number, number];
};

type LevelData = {
  levelName: string;
  levelNum: number;
  flags: number[];
  info: number[];
  startingPos: [number, number];
  music: number;
  pxBackTilesetID: number;
  pxMidTilesetID: number;
  fgTilesetID: number;
  bgTilesetID: number;
  fgPatternTilesetID: number;
  fgOverlayTilesetID: number;
  spriteClutID: number;
  tileClutID: number;
  comboClutID: number;
  fgTileDefs: number[];
  bgTileDefs: number[];
  pxBackRowScrollSpeeds: number[];
  pxMidRowScrollSpeeds: number[];
  pxBackBaseScrollSpeed: number;
  pxMidBaseScrollSpeed: number;
  pxBackBaseSpeedH: number;
  pxBackBaseSpeedV: number;
  pxMidBaseSpeedH: number;
  pxMidBaseSpeedV: number;
  pxBackTileMapSizeH: number;
  pxBackTileMapSizeV: number;
  pxMidTileMapSizeH: number;
  pxMidTileMapSizeV: number;
  mainTileMapSizeH: number;
  mainTileMapSizeV: number;
  pxBackTileMap: number[];
  pxMidTileMap: number[];
  bgTileMap: number[];
  fgTileMap: number[];
  fgOverlayTileMap: number[];
  sprites: LevelSpriteData[];
};

function fwRead(filename: string): TileMap {
  let f = new TextFile(filename);
  let dataJsonString = f.readAll();
  let data: LevelData = JSON.parse(dataJsonString);

  // not great
  let dirname = filename.replace(/\/[^/]+$/, "/");
  let worldData = Qt.resolvedUrl(dirname.concat("../../"));
  let worldDataFile = (path: string) => {
    return new URL(path, worldData.toString()).pathname;
  };

  let tm = new TileMap();
  tm.setSize(data.mainTileMapSizeH, data.mainTileMapSizeV);
  tm.setTileSize(32, 32);
  tm.setProperty("Original JSON data", dataJsonString);
  tm.setProperty("Level name", data.levelName);
  tm.setProperty("Music track", data.music);
  tm.setProperty("Level info", data.info);
  tm.setProperty("Level flags", data.flags);

  let loopParallaxTileMapLayer: (
    tm: TileMap,
    tilemap: number[],
    baseScrollSpeed: number,
    rowScrollSpeeds: number[],
    [tileMapSizeH, tileMapSizeV]: [number, number],
    tileset: Tileset,
  ) => void = (
    tm,
    tilemap,
    baseScrollSpeed,
    rowScrollSpeeds,
    [tileMapSizeH, tileMapSizeV],
    tileset,
  ) => {
    let tilesetWidth = Math.floor(tileset.imageSize.width / 128);
    let editMap = new Map<number, TileLayerEdit>();
    var skip = 0;
    let makeLayer = (rowSpeed: number) => {
      let layer = new TileLayer(tileset.name);
      layer.size = Qt.size(tileMapSizeH * 4, tileMapSizeV * 4);
      layer.parallaxFactor = Qt.point(rowSpeed / 256, baseScrollSpeed / 256);
      layer.offset = Qt.point(0, (skip / tileMapSizeH) * 32);
      tm.addLayer(layer);
      return layer.edit();
    };
    let getEdit = (row: number) => {
      let rowSpeed = rowScrollSpeeds[row];
      let edit = editMap.get(rowSpeed);
      if (edit === undefined) {
        edit = makeLayer(rowSpeed);
        editMap.set(rowSpeed, edit);
      }
      return edit;
    };
    tilemap.forEach((t, e) => {
      if (t < 0) {
        skip += 1;
        return;
      }
      let tx = t % tilesetWidth;
      let ty = Math.floor(t / tilesetWidth);
      e -= skip;
      let x = (e % tileMapSizeH) * 4;
      let y = Math.floor(e / tileMapSizeH) * 4 + 3;
      let rowmin = ty * 128;
      for (var i = 0; i < 128; i += 1) {
        getEdit(rowmin + i).setTile(x, y, tileset.tile(t));
      }
    });
    for (const edit of editMap.values()) {
      edit.apply();
    }
  };

  let pxb = new Tileset("Parallax background");
  pxb.setTileSize(128, 128);
  pxb.imageFileName = worldDataFile(`sprites/${data.pxBackTilesetID}.png`);
  tm.addTileset(pxb);

  loopParallaxTileMapLayer(
    tm,
    data.pxBackTileMap,
    data.pxBackBaseScrollSpeed,
    data.pxBackRowScrollSpeeds,
    [data.pxBackTileMapSizeH, data.pxBackTileMapSizeV],
    pxb,
  );

  let loopTileMapLayer: (
    layer: TileLayer,
    tilemap: number[],
    [tileMapSizeH, tileMapSizeV]: [number, number],
    callback: (t: number, x: number, y: number) => Tile | null,
  ) => void = (layer, tilemap, [tileMapSizeH, tileMapSizeV], callback) => {
    let edit = layer.edit();
    tilemap.forEach((t, e) => {
      let x = e % tileMapSizeH;
      let y = Math.floor(e / tileMapSizeH);
      let tile = callback(t, x, y);
      if (tile === null) {
        return;
      }
      edit.setTile(x, y, tile);
    });
    edit.apply();
  };

  let mainTileMapSize: [number, number] = [
    data.mainTileMapSizeH,
    data.mainTileMapSizeV,
  ];
  let bg = new Tileset("Background");
  bg.setTileSize(32, 32);
  bg.imageFileName = worldDataFile(`sprites/${data.bgTilesetID}.png`);
  data.bgTileDefs.forEach((d, e) => {
    bg.tile(e).setProperty("Tiledef", d);
  });
  tm.addTileset(bg);

  let bgl = new TileLayer("Background");
  loopTileMapLayer(bgl, data.bgTileMap, mainTileMapSize, (t) => {
    let bgt = t & 0xff;
    return bgt == 0 ? null : bg.tile(bgt - 1);
  });
  tm.addLayer(bgl);

  let fg = new Tileset("Foreground");
  fg.setTileSize(32, 32);
  fg.imageFileName = worldDataFile(`sprites/${data.fgTilesetID}.png`);
  data.fgTileDefs.forEach((d, e) => {
    fg.tile(e).setProperty("Tiledef", d);
  });
  tm.addTileset(fg);

  let fgl = new TileLayer("Foreground");
  loopTileMapLayer(fgl, data.fgTileMap, mainTileMapSize, (t) => {
    let fgt = t & 0xff;
    return fgt == 0 ? null : fg.tile(fgt - 1);
  });
  tm.addLayer(fgl);

  var fgo: Tileset;
  if (
    data.fgOverlayTilesetID != 0 &&
    data.fgOverlayTilesetID != data.fgTilesetID
  ) {
    fgo = new Tileset("Foreground overlay");
    fgo.setTileSize(32, 32);
    fgo.imageFileName = worldDataFile(`sprites/${data.fgOverlayTilesetID}.png`);
    tm.addTileset(fgo);
  } else {
    fgo = fg;
  }

  let fgol = new TileLayer("Foreground overlay");
  loopTileMapLayer(fgol, data.fgOverlayTileMap, mainTileMapSize, (t) => {
    if ((t & 0xff) != 101) {
      return null;
    }
    let fgt = t >> 8;
    return fgt == 0 ? null : fgo.tile(fgt - 1);
  });

  if (data.fgPatternTilesetID != 0) {
    let fgp = new Tileset("Foreground pattern");
    fgp.setTileSize(32, 32);
    fgp.imageFileName = worldDataFile(`sprites/${data.fgPatternTilesetID}.png`);
    tm.addTileset(fgp);
    let patternSize = data.flags[5] == 0 ? 8 : 6;
    let fgpTile = (x: number, y: number) => {
      return fgp.tile((x % patternSize) + (y % patternSize) * patternSize);
    };

    let fgpl = new TileLayer("Foreground pattern");
    loopTileMapLayer(fgpl, data.fgTileMap, mainTileMapSize, (t, x, y) => {
      let fgt = t & 0xff;
      return fgt == 96 ? fgpTile(x, y) : null;
    });
    tm.addLayer(fgpl);
    tm.addLayer(fgol);

    let fgopl = new TileLayer("Foreground overlay pattern");
    loopTileMapLayer(
      fgopl,
      data.fgOverlayTileMap,
      mainTileMapSize,
      (t, x, y) => {
        if ((t & 0xff) != 101) {
          return null;
        }
        let fgt = t >> 8;
        return fgt == 96 ? fgpTile(x, y) : null;
      },
    );
    tm.addLayer(fgopl);
  } else {
    tm.addLayer(fgol);
  }

  let cr = new Tileset("Crunch tiles");
  cr.setTileSize(32, 32);
  cr.imageFileName = worldDataFile("editor/crunch-tiles.png");
  tm.addTileset(cr);

  let crl = new TileLayer("Crunch tiles");
  crl.offset = Qt.point(16, 16);
  loopTileMapLayer(crl, data.fgTileMap, mainTileMapSize, (t, x, y) => {
    let crt = t >> 8;
    if ((crt & 0xf) > 4) {
      tiled.warn(`ignoring bogus crunch tile ${crt} @ (${x}, ${y})`, () => {});
      return null;
    }
    return (crt & 0xf0) == 0 ? null : cr.tile(crt & 0xf);
  });
  tm.addLayer(crl);

  let wd = new Tileset("Wind direction");
  wd.setTileSize(32, 32);
  wd.imageFileName = worldDataFile("editor/wind-direction.png");
  tm.addTileset(wd);

  let wdl = new TileLayer("Wind direction");
  loopTileMapLayer(wdl, data.fgOverlayTileMap, mainTileMapSize, (t, x, y) => {
    let wdt = (t & 0xff) - 1;
    return wdt < 0 || wdt >= 36 ? null : wd.tile(wdt);
  });
  tm.addLayer(wdl);

  let ws = new Tileset("Wind strength");
  ws.setTileSize(32, 32);
  ws.imageFileName = worldDataFile("editor/wind-strength.png");
  tm.addTileset(ws);

  let wsl = new TileLayer("Wind strength");
  loopTileMapLayer(wsl, data.fgOverlayTileMap, mainTileMapSize, (t, x, y) => {
    let wst = (t >> 8) - 1;
    return wst < 0 ? null : ws.tile(Math.floor(wst / 4));
  });
  tm.addLayer(wsl);

  let spl = new ObjectGroup("Sprites");
  let sps = new Tileset("Sprites");
  let spsMap = new Map();
  data.sprites.forEach((sprite, id) => {
    if (sprite.valid == 0) {
      return;
    }
    var spt = spsMap.get(sprite.kind);
    if (spt === undefined) {
      spt = sps.addTile();
      spt.imageFileName = worldDataFile(`editor/${sprite.kind}.png`);
      spsMap.set(sprite.kind, spt);
    }
    let obj = new MapObject();
    obj.tile = spt;
    obj.pos = Qt.point(sprite.where[1], sprite.where[0] + spt.size.height);
    obj.size = spt.size;
    obj.setProperty("id", id);
    obj.setProperty("kind", sprite.kind);
    obj.setProperty("validity", sprite.valid);
    obj.setProperty("info", sprite.info);
    spl.addObject(obj);
  });
  tm.addTileset(sps);
  tm.addLayer(spl);

  let pxm = new Tileset("Parallax middle");
  pxm.setTileSize(128, 128);
  pxm.imageFileName = worldDataFile(`sprites/${data.pxMidTilesetID}.png`);
  tm.addTileset(pxm);

  loopParallaxTileMapLayer(
    tm,
    data.pxMidTileMap,
    data.pxMidBaseScrollSpeed,
    data.pxMidRowScrollSpeeds,
    [data.pxMidTileMapSizeH, data.pxMidTileMapSizeV],
    pxm,
  );

  let ml = new ObjectGroup("Meta");
  let start = new MapObject(MapObject.Point, "Starting position");
  start.pos = Qt.point(data.startingPos[1], data.startingPos[0]);
  ml.addObject(start);
  tm.addLayer(ml);

  return tm;
}

// TODO: handle tilemap layer resize

function fwWrite(tm: TileMap, filename: string): string | undefined {
  let dataJsonString = tm.property("Original JSON data");
  if (typeof dataJsonString !== "string") {
    return "expected JSON data is not a string";
  }
  let data: LevelData = JSON.parse(dataJsonString);

  data.levelName = tm.resolvedProperty("Level name");
  data.music = tm.resolvedProperty("Music track");
  data.info = tm.resolvedProperty("Level info");
  data.flags = tm.resolvedProperty("Level flags");

  for (const layer of tm.layers) {
    const tileLayer = <TileLayer>layer;
    const objectLayer = <ObjectGroup>layer;
    switch (layer.name) {
      case "Foreground":
        data.fgTileMap = data.fgTileMap.map((t, e) => {
          let x = e % data.mainTileMapSizeH;
          let y = Math.floor(e / data.mainTileMapSizeH);
          let tile = tileLayer.tileAt(x, y);
          let fgt = tile !== null ? tile.id + 1 : 0;
          return (t & ~0xff) | fgt;
        });
        break;

      case "Crunch tiles":
        data.fgTileMap = data.fgTileMap.map((t, e) => {
          let x = e % data.mainTileMapSizeH;
          let y = Math.floor(e / data.mainTileMapSizeH);
          let tile = tileLayer.tileAt(x, y);
          var crt = 0;
          if (tile !== null) {
            crt = tile.id;
            // preserve original 'crunch direction' nybble if present
            let dir = (t >> 8) & 0xf0;
            if (dir != 0) {
              crt |= dir;
            } else {
              crt |= 0x10;
            }
          }
          return (t & ~0xff00) | (crt << 8);
        });
        break;

      case "Background":
        data.bgTileMap = data.bgTileMap.map((t, e) => {
          let x = e % data.mainTileMapSizeH;
          let y = Math.floor(e / data.mainTileMapSizeH);
          let tile = tileLayer.tileAt(x, y);
          let bgt = tile !== null ? tile.id + 1 : 0;
          return (t & ~0xff) | bgt;
        });
        break;

      case "Sprites":
        let spritesMap = new Map<number, MapObject>();
        for (const obj of objectLayer.objects) {
          let id = obj.resolvedProperty("id");
          if (id === undefined) continue;
          spritesMap.set(id, obj);
        }
        data.sprites = data.sprites.map((s, e) => {
          let obj = spritesMap.get(e);
          if (obj === undefined) {
            s.valid = 0;
            return s;
          }
          s.kind = obj.resolvedProperty("kind");
          s.valid = obj.resolvedProperty("validity");
          s.info = obj.resolvedProperty("info");
          s.where = [Math.floor(obj.y - obj.size.height), Math.floor(obj.x)];
          return s;
        });
        break;

      case "Meta":
        for (const obj of objectLayer.objects) {
          switch (obj.name) {
            case "Starting position":
              data.startingPos = [Math.floor(obj.y), Math.floor(obj.x)];
              break;
          }
        }
        break;
    }
  }

  let f = new TextFile(filename, TextFile.WriteOnly);
  f.write(JSON.stringify(data));
  f.commit();
  return;
}

tiled.registerMapFormat("ferazels-wand", {
  extension: "json",
  name: "Ferazel's Wand level data",
  read: fwRead,
  write: fwWrite,
});
