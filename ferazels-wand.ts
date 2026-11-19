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
  tm.setProperty("Level name", data.levelName);
  tm.setProperty("Music track", data.music);
  tm.setProperty("Original JSON data", dataJsonString);

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
    sprite.info.forEach((i, e) => {
      obj.setProperty(`info[${e}]`, i);
    });
    spl.addObject(obj);
  });
  tm.addTileset(sps);
  tm.addLayer(spl);

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

  for (const layer of tm.layers) {
    switch (layer.name) {
      case "Foreground":
        data.fgTileMap = data.fgTileMap.map((t, e) => {
          let x = e % data.mainTileMapSizeH;
          let y = Math.floor(e / data.mainTileMapSizeH);
          let tile = layer.tileAt(x, y);
          let fgt = tile !== null ? tile.id + 1 : 0;
          return (t & ~0xff) | fgt;
        });
        break;

      case "Crunch tiles":
        data.fgTileMap = data.fgTileMap.map((t, e) => {
          let x = e % data.mainTileMapSizeH;
          let y = Math.floor(e / data.mainTileMapSizeH);
          let tile = layer.tileAt(x, y);
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
          let tile = layer.tileAt(x, y);
          let bgt = tile !== null ? tile.id + 1 : 0;
          return (t & ~0xff) | bgt;
        });
        break;

      case "Sprites":
        let spritesMap = new Map();
        for (const obj of layer.objects) {
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
          s.where = [Math.floor(obj.y - obj.size.height), Math.floor(obj.x)];
          s.info = s.info.map((_, e) => {
            return obj.resolvedProperty(`info[${e}]`);
          });
          return s;
        });
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
