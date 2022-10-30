// import howler sound library
import './howler/dist/howler.js';
//import { Howl } from './howler/dist/howler.js';

// get canvas details
const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

// const youWinCanvas = document.getElementById('youWinCanvas');
// const youWinCtx = youWinCanvas.getContext('2d');

const collisionCanvas = document.getElementById('collisionCanvas');
const collisionCtx = collisionCanvas.getContext('2d');

const resW = 1920;
const resH = 1080;
canvas.width = resW;
canvas.height = resH;

collisionCanvas.width = resW;
collisionCanvas.height = resH;

// youWinCanvas.width = resW;
// youWinCanvas.height = resH;

// state of the game
// all assets have been preloaded
let gameInitialised = false;
// start the game (from 'initialSplashScreen','gameStart','gameOver'/'youWin')
let gameStatus = false;
// the master game speed
let masterGameSpeed = 80;
// record the space bar state for constrolling the balloon
let spaceBarState = false,
  arrowLeftState = false,
  arrowRightState = false;

// game loop variables
let oldTimeStamp = 0,
  deltaTimeInSeconds,
  accumulativeDeltaTimeInSeconds;
let timeToNextCloud = 0;
let cloudInterval = 7; // every 7 seconds

// delay after collision explosion before displaying 'Game Over Text'
let timeAfterExplosionBeforeDisplayingGameOverTimer = 0;
let timeAfterExplosionBeforeDisplayingGameOver = 2.5;

// displaying the 'You win' object after the fanfare has played
let timeAfterFanfareTimer = 0;
let timeAfterFanFare = 0.2;

//initialise collision data variables
let landscapeObjectArray = [];
let balloonObjectArray = [];
let balloonExplosionObjectArray = [];
let landscapeWaterObjectArray = [];
let cloudObjectArray = [];
let cannonObjectArray = [];
let cannonBallObjectArray = [];
let windTurbineObjectArray = [];
let sharkFinObjectArray = [];
let sharkHeadObjectArray = [];
let sharkLaserObjectArray = [];
let iceGhostObjectArray = [];
let easterIslandObjectArray = [];
let easterIslandBallObjectArray = [];
let collisionDetectionObjectArray = [];
let goldenCoinObjectArray = [];
let mathChallengeObjectArray = [];
let scoreObjectArray = [];
let gameOverObjectArray = [];
let youWinObjectArray = [];

// variables to ensure there isn't a doible placement of
// elements on the landscape. These variables work alongside the
// objectPlacementOnXAxis helper function function
let windTurbinePlacement = { x: 0 };
let cannonPlacement = { x: 0 };
let sharkFinPlacement = { x: 0 };
let sharkHeadPlacement = { x: 0 };
let iceGhostPlacement = { x: 0 };
let easterIslandPlacement = { x: 0 };

////////////////////////////////////////////////
// array to hole the preloaded assets //////////
// hold the array of images (including sprites)
let preLoadedImageArray = [];
// hold the collision data polygon data
let collisionDataArray = [];
// hold the sounds
let soundsArray = [];
// save the sprite sheet arrays
let spriteSheetArrays = [];

////////////////////////////////////////////////
// array of image files to preload /////////////
const imageFiles = [
  '/images/cloud1.png',
  '/images/cloud2.png',
  '/images/cloud3.png',
  '/images/cloud4.png',
  '/images/cloud5.png',
  '/images/cloud6.png',
  '/images/cloud7.png',
  '/images/cloud8.png',
  '/images/cloud9.png',
  '/images/cloud10.png',
  '/images/cloud11.png',
  '/images/cloud12.png',
  '/images/cloud13.png',
  '/images/cloud14.png',
  '/images/cloud15.png',
  '/images/cloud16.png',
  '/images/cloud17.png',
  '/images/cloud18.png',
  '/images/cloud19.png',
  '/images/cloud20.png',
  '/images/windTurbineSpriteSheet.png',
  '/images/land.png',
  '/images/balloon.png',
  '/images/cannonSpriteSheetLeft.png',
  '/images/cannonSpriteSheetRight.png',
  '/images/sharkFinSpriteSheetLeft.png',
  '/images/sharkFinSpriteSheetRight.png',
  '/images/landWater.png',
  '/images/sharkHeadSpriteSheet.png',
  '/images/iceGhostSpriteSheet.png',
  '/images/easterIslandSpriteSheet.png',
  '/images/easterIslandBall.png',
  '/images/1Coin.png',
  '/images/2Coin.png',
  '/images/3Coin.png',
  '/images/4Coin.png',
  '/images/5Coin.png',
  '/images/6Coin.png',
  '/images/7Coin.png',
  '/images/8Coin.png',
  '/images/9Coin.png',
  '/images/10Coin.png',
  '/images/balloonExplosion.png',
];

function loadImage(src) {
  return new Promise(function (resolve) {
    let image = new Image();
    image.onload = function () {
      resolve(image);
    };
    image.src = src;
  });
}

const loadAll = async function () {
  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const myImage = await loadImage(imageFiles[i]);
      // console.log(`${imgArr[i]} loading into array..`);
      // save the preloaded image and the image name in an array
      preLoadedImageArray.push({
        src: imageFiles[i],
        image: myImage,
        imageName: imageFiles[i].slice(8),
      });
    }

    // return;
  } catch (err) {
    console.error(err);
  }
};

///////////////////////////////////////////////
///////////////////////////////////////////////
// preload collision data variables ///////////
let balloonCollisionData,
  landscapeCollisionData,
  cannonBallCollisionData,
  easterIslandBallCollisionData,
  iceGhostCollisionData,
  windTurbineCollisionData,
  coinCollisionData = [];

const loadCollisionData = async function () {
  try {
    // get the balloon collision data polygon
    let balloonCollision = await fetch(
      './imageCollisionData/balloonCollisionData.json'
    );
    balloonCollisionData = await balloonCollision.json();
    collisionDataArray.push({ name: 'balloon', data: balloonCollisionData });

    // get the landscape collision data polygon
    let landscapeCollision = await fetch(
      './imageCollisionData/landscapeCollisionData.json'
    );
    landscapeCollisionData = await landscapeCollision.json();
    collisionDataArray.push({
      name: 'landscape',
      data: landscapeCollisionData,
    });

    // get the cannon ball collision data polygon
    let cannonBallCollision = await fetch(
      './imageCollisionData/cannonBallCollisionData.json'
    );
    cannonBallCollisionData = await cannonBallCollision.json();
    collisionDataArray.push({
      name: 'cannonBall',
      data: cannonBallCollisionData,
    });

    // get the rings of death collision data polygon
    let easterIslandBallCollision = await fetch(
      './imageCollisionData/easterIslandCollisionData.json'
    );
    easterIslandBallCollisionData = await easterIslandBallCollision.json();
    collisionDataArray.push({
      name: 'easterIslandBall',
      data: easterIslandBallCollisionData,
    });

    // get the iceGhost collision data polygon
    let iceGhostCollision = await fetch(
      './imageCollisionData/iceGhostCollisionData.json'
    );
    iceGhostCollisionData = await iceGhostCollision.json();
    collisionDataArray.push({ name: 'iceGhost', data: iceGhostCollisionData });

    // get the windTurbine collision data polygon
    let windTurbineCollision = await fetch(
      './imageCollisionData/windturbineCollisionData.json'
    );
    windTurbineCollisionData = await windTurbineCollision.json();
    collisionDataArray.push({
      name: 'windTurbine',
      data: windTurbineCollisionData,
    });

    // get the coin collision data polygon
    let coinCollision = await fetch(
      './imageCollisionData/coinCollisionData.json'
    );
    coinCollisionData = await coinCollision.json();
    collisionDataArray.push({ name: 'coin', data: coinCollisionData });
  } catch (err) {
    console.error(err);
  }
};

////////////////////////////////////////////////////////
// preload sounds
const loadSounds = async function () {
  try {
    let pop1Sound = await new Howl({
      src: ['/sounds/pop1.mp3'],
    });
    soundsArray.push({ name: 'pop1Sound', sound: pop1Sound });
    let pop2Sound = await new Howl({
      src: ['/sounds/pop2.mp3'],
    });
    soundsArray.push({ name: 'pop2Sound', sound: pop2Sound });
    let pop3Sound = await new Howl({
      src: ['/sounds/pop3.mp3'],
    });
    soundsArray.push({ name: 'pop3Sound', sound: pop3Sound });
    let pop4Sound = await new Howl({
      src: ['/sounds/pop4.mp3'],
    });
    soundsArray.push({ name: 'pop4Sound', sound: pop4Sound });
    let pop5Sound = await new Howl({
      src: ['/sounds/pop5.mp3'],
    });
    soundsArray.push(pop5Sound);
    let pop6Sound = await new Howl({
      src: ['/sounds/pop6.mp3'],
    });
    soundsArray.push({ name: 'pop5Sound', sound: pop6Sound });

    let fuseSound = await new Howl({
      src: ['/sounds/Fuse.mp3'],
    });
    soundsArray.push({ name: 'fuseSound', sound: fuseSound });

    let cannonBallSound = await new Howl({
      src: ['/sounds/cannonShot.mp3'],
    });
    soundsArray.push({ name: 'cannonBallSound', sound: cannonBallSound });

    let lifeIsBeautiful = await new Howl({
      src: ['/sounds/lifeIsBeautiful.mp3'],
      onFade: function () {
        console.log('--------------------fade');
      },
    });
    soundsArray.push({ name: 'lifeIsBeautifulSound', sound: lifeIsBeautiful });

    let collectCoinSound = await new Howl({
      src: ['/sounds/collectCoin.mp3'],
    });
    soundsArray.push({ name: 'collectCoinSound', sound: collectCoinSound });

    let correctAnswer = await new Howl({
      src: ['/sounds/correctAnswer.mp3'],
    });
    soundsArray.push({ name: 'correctAnswer', sound: correctAnswer });

    let wrongAnswer = await new Howl({
      src: ['/sounds/wrongAnswer.mp3'],
    });
    soundsArray.push({ name: 'wrongAnswer', sound: wrongAnswer });

    let laserSound = await new Howl({
      src: ['/sounds/laser.mp3'],
    });
    soundsArray.push({ name: 'laserSound', sound: laserSound });

    let explosionSound = await new Howl({
      src: ['/sounds/balloonExplosion.mp3'],
    });
    soundsArray.push({ name: 'explosionSound', sound: explosionSound });

    let halloweenGhost1 = await new Howl({
      src: ['/sounds/halloweenGhost1.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost1Sound', sound: halloweenGhost1 });

    let halloweenGhost2 = await new Howl({
      src: ['/sounds/halloweenGhost2.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost2Sound', sound: halloweenGhost2 });

    let halloweenGhost3 = await new Howl({
      src: ['/sounds/halloweenGhost3.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost3Sound', sound: halloweenGhost3 });

    let halloweenGhost4 = await new Howl({
      src: ['/sounds/halloweenGhost4.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost4Sound', sound: halloweenGhost4 });

    let halloweenGhost5 = await new Howl({
      src: ['/sounds/halloweenGhost5.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost5Sound', sound: halloweenGhost5 });

    let halloweenGhost6 = await new Howl({
      src: ['/sounds/halloweenGhost6.mp3'],
    });
    soundsArray.push({ name: 'halloweenGhost6Sound', sound: halloweenGhost6 });

    // this is used as the win fanfare when the player gets to the end
    // of the landscape
    let handyIntroduction = await new Howl({
      src: ['/sounds/handy-introduction-022-glbml-21786.mp3'],
    });
    soundsArray.push({ name: 'handyIntroduction', sound: handyIntroduction });
  } catch (err) {
    console.error(err);
  }
};

//////////////////////////////////////////////////////
//// create sprite sheet arrays //////////////////////
// create sprite sheet arrays
// function to take a sprite sheet from inkscape and
// make an array of x,y coordinates in the sprite sheet
// for each sprite. Because Inkscape makes the sprite sheet
// from back to front, the returned array is also reversed.
// So Element 0 = frame 1
// Element 1 = frame 2 ... etc
function createArrayFromSpriteSheet(
  spriteRows,
  spriteColumns,
  totalNumberOfSprites,
  spriteSheetWidthInPixels,
  spriteSheetHeightInPixels,
  reverse = true
) {
  const imageWidth = spriteSheetWidthInPixels / spriteColumns;
  const imageHeight = spriteSheetHeightInPixels / spriteRows;
  let x,
    y,
    spriteCount = 0,
    array = [];
  for (let rows = 0; rows < spriteRows; rows++) {
    for (let cols = 0; cols < spriteColumns; cols++) {
      if (spriteCount === totalNumberOfSprites) break;

      x = imageWidth * cols;
      y = imageHeight * rows;

      array.push({ x: x, y: y });
      spriteCount++;
    }
  }
  if (reverse) array.reverse();

  return array;
}

// get a random number between min and max (inclusive)
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

// object placement on x-axis
function objectPlacementOnXAxis(timer, placeAtValue, placementObject) {
  if (
    Math.round(timer) > placeAtValue &&
    Math.round(timer) < placeAtValue + 100 &&
    Math.round(timer) > placementObject.x + 100
  ) {
    placementObject.x = timer;
    return true;
  }
}

// calculate the sprite sheet arrays
// and push them into spriteSheetArrays
function createSpriteSheetArrays() {
  spriteSheetArrays.push({
    name: 'cannonSpriteXYArray',
    array: createArrayFromSpriteSheet(7, 8, 50, 1361, 1191),
  });
  spriteSheetArrays.push({
    name: 'windTurbineSpriteXYArray',
    array: createArrayFromSpriteSheet(1, 12, 12, 5040, 682),
  });

  spriteSheetArrays.push({
    name: 'sharkFinSpriteXYArray',
    array: createArrayFromSpriteSheet(28, 1, 28, 351, 1690),
  });

  spriteSheetArrays.push({
    name: 'sharkHeadSpriteXYArray',
    array: createArrayFromSpriteSheet(31, 1, 31, 206, 3744),
  });

  spriteSheetArrays.push({
    name: 'iceGhostSpriteXYArray',
    array: createArrayFromSpriteSheet(3, 4, 11, 1594, 1757),
  });

  spriteSheetArrays.push({
    name: 'easterIslandSpriteXYArray',
    array: createArrayFromSpriteSheet(1, 2, 2, 415, 459),
  });

  spriteSheetArrays.push({
    name: 'goldenCoinSpriteXYArray',
    array: createArrayFromSpriteSheet(1, 31, 31, 3658, 120, false),
  });

  spriteSheetArrays.push({
    name: 'balloonExplosionSpriteSheetXYArray',
    array: createArrayFromSpriteSheet(1, 64, 64, 24576, 384, false),
  });
}

///////////////////
// will be part of init soon
loadAll();
loadCollisionData();
loadSounds();
createSpriteSheetArrays();
gameInitialised = true;
///////////////////

/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////// GAME OBJECTS ///////////////////////////
class Balloon {
  constructor() {
    // landscape image
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'balloon.png'
    ).image;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 166;
    this.sHeight = 227;
    this.dX = 100;
    this.dY = 700;
    this.dWidth = 166;
    this.dHeight = 227;
    this.heatInBalloon = 0;
    this.rateOfHeatAddition = 7;
    this.rateOfHeatDischarge = 0;

    this.accelarationX = 0;
    this.accelarationY = 3;

    this.markedForDeletion = false;

    this.accelarationOffScreen = 0;

    this.fadeSound = false;
  }

  balloonAddGas(deltaTimeInSeconds) {
    //console.log('balloon delta time', deltaTimeInSeconds);
    this.heatInBalloon += this.rateOfHeatAddition * deltaTimeInSeconds;
  }

  moveOnXAxis(deltaTimeInSeconds) {
    if (arrowRightState === true)
      this.accelarationX += deltaTimeInSeconds * this.accelarationY;

    if (arrowLeftState === true)
      this.accelarationX -= deltaTimeInSeconds * this.accelarationY;

    // if left or right keys not pressed, decelarate movement
    // on the x-axis down to zero
    if (!arrowLeftState && !arrowRightState)
      if (this.accelarationX > 0) {
        this.accelarationX -= deltaTimeInSeconds;
      } else {
        this.accelarationX += deltaTimeInSeconds;
      }
  }

  accelarateRightOffScreen(deltaTimeInSeconds) {
    // this method will be called when the player has got
    // to the end of the game, we want the balloon to accelarate
    // from whatever speed it's going, to off screen to the right
    this.accelarationOffScreen += 12;
    this.dX +=
      this.accelarationX + this.accelarationOffScreen * deltaTimeInSeconds;

    // fade out the theme tune - trigger this only once
    if (!this.fadeSound) {
      soundsArray
        .find(e => e.name === 'lifeIsBeautifulSound')
        .sound.fade(1, 0, 1500);
      this.fadeSound = true;
      // play the 'You win' fanfare!
      soundsArray.find(e => e.name === 'handyIntroduction').sound.play();
    }
  }

  balloonMovementPhysics() {
    // console.log(this.heatInBalloon);
    // heat dissipating from the balloon
    this.heatInBalloon -= this.rateOfHeatDischarge;
    if (this.heatInBalloon < 0) {
      this.rateOfHeatDischarge = 0.02;
    } else {
      this.rateOfHeatDischarge = 0.04;
    }

    this.dY -= this.heatInBalloon;
    this.dX += this.accelarationX;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place tihe image
      this.dY, // y coord in destination canvas in which to place tihe image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class BalloonExplosion {
  // the constructor will receive the x,y coordinates of where the
  // balloon is when it collides/explodes so that the explosion
  // occurs in the correct place
  constructor(x, y) {
    this.explosionSound = soundsArray.find(
      e => e.name === 'explosionSound'
    ).sound;

    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'balloonExplosion.png'
    ).image;

    this.balloonExplosionSpriteSheetXYArray = spriteSheetArrays.find(
      obj => obj.name === 'balloonExplosionSpriteSheetXYArray'
    ).array;
    //this.image = preLoadedImageArray[42].image;
    this.frame = 0;
    this.maxFrame = 62;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 384;
    this.sHeight = 384;
    this.dX = x;
    this.dY = y;
    this.dWidth = this.sWidth * 2;
    this.dHeight = this.sHeight * 2;

    this.speed = masterGameSpeed;

    this.timer = 0;
    this.explosionSpeed = 0.04;

    this.markedForDeletion = false;
  }

  update(deltaTimeInSeconds) {
    this.timer += deltaTimeInSeconds;
    if (this.timer > this.explosionSpeed) {
      if (this.frame === this.maxFrame) return;

      if (this.frame === 0) {
        // play explosion sound
        this.explosionSound.play();
        // fade out the background music

        //  landscapeObjectArray[0].lifeIsBeautifulSound.fade(1, 0, 1000);
        soundsArray
          .find(e => e.name === 'lifeIsBeautifulSound')
          .sound.fade(1, 0, 1000);

        // this stops the main game loop
      }
      if (this.frame === this.maxFrame) {
        // mark this explosion object for deletion
        // so it can be deleted in the game loop
        this.markedForDeletion = true;
      }

      if (this.frame === 16) {
        // explosion is at a maximum size so
        // we can delete the balloon as it's
        // hidden behind it
        balloonObjectArray[0].markedForDeletion = true;
        // also delete the cannon ball(s) as it looks odd
        // if it's still there after the explosion
        [...cannonBallObjectArray].forEach(
          element => (element.markedForDeletion = true)
        );
      }
      this.frame++;
      this.timer = 0;
    }

    // this.dX -= this.speed * deltaTimeInSeconds;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.balloonExplosionSpriteSheetXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.balloonExplosionSpriteSheetXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class Cannon {
  constructor(leftRightFace) {
    // fuse and cannon firing sounds
    this.fuseSound = soundsArray.find(e => e.name === 'fuseSound').sound;
    this.cannonBallSound = soundsArray.find(
      e => e.name === 'cannonBallSound'
    ).sound;

    if (leftRightFace === 'left') {
      this.facing = 'left';
      this.image = preLoadedImageArray.find(
        obj => obj.imageName === 'cannonSpriteSheetLeft.png'
      ).image;
      //this.image = preLoadedImageArray[23].image; // left size facing cannon sprite sheet
    } else {
      this.image = preLoadedImageArray.find(
        obj => obj.imageName === 'cannonSpriteSheetRight.png'
      ).image;
      //this.image = preLoadedImageArray[24].image; // right size facing cannon sprite sheet
    }

    // get the cannon sprite sheet array
    this.cannonSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'cannonSpriteXYArray'
    ).array;

    // 50 frame sprite sheet
    this.frame = 0;
    this.maxFrame = 48;
    // for the draw function

    this.sX = 0;
    this.sY = 0;
    // size of sprite
    this.sWidth = 170;
    this.sHeight = 170;
    //position on canvas
    // size on canvas
    this.dWidth = this.sWidth;
    this.dHeight = this.sHeight;

    this.dX = canvas.width;
    this.dY =
      canvas.height - this.dHeight - Math.round(getRandomArbitrary(20, 100));

    // horizontal movement of the cannon
    this.speed = masterGameSpeed;

    // speed between the frames on the sprite sheet
    this.cannonSpriteFrameSpeed = 0;

    // firing the cannon animation
    this.firingTheCannon = false;
    this.cannonShotTiming = Math.round(getRandomArbitrary(1, 5));
    this.timeBetweenLastCannonShot = 0;

    this.cannonAnimationSpeed = 0.2;

    // property of whether this object is marked for deletion or not
    this.markedForDeletion = false;
  }

  // horizontal y movement of cannon
  update(deltaTimeInSeconds) {
    this.dX -= this.speed * deltaTimeInSeconds;

    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }

  // animating the cannon firing
  firingCannonAnimation(deltaTimeInSeconds) {
    if (this.firingTheCannon) {
      this.timeBetweenLastCannonShot += deltaTimeInSeconds;
      //console.log('-------------' + this.timeBetweenLastCannonShot);
      if (this.timeBetweenLastCannonShot > this.cannonAnimationSpeed) {
        // play the fuse sound effect
        if (this.frame === 0) {
          this.fuseSound.play();
        }

        if (this.frame > this.maxFrame) {
          this.frame = 0;
          this.firingTheCannon = false;
        } else {
          this.frame++;
          this.timeBetweenLastCannonShot = 0;

          // on frame 34 we want to fire a cannon ball
          if (this.frame === 34) {
            // create a new cannon ball object
            cannonBallObjectArray.push(
              new CannonBall(this.dX, this.dY, this.facing)
            );
            this.cannonBallSound.play();
          }
        }
      }
    }
  }

  // should the cannnon be fire yet?
  fireTheCannon(deltaTimeInSeconds) {
    this.timeBetweenLastCannonShot += deltaTimeInSeconds;
    if (this.timeBetweenLastCannonShot > this.cannonShotTiming) {
      this.firingTheCannon = true;
      this.timeBetweenLastCannonShot = 0;
    }
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.cannonSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.cannonSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class CannonBall {
  constructor(cannonBallX, cannonBallY, facing) {
    // integers are correcting position of the
    // so that it comes out of the cannon nozzle
    this.facing = facing;
    if (this.facing === 'left') {
      this.x = cannonBallX + 35;
      this.y = cannonBallY + 30;
    } else {
      // cannon is facing to the right
      this.x = cannonBallX + 140;
      this.y = cannonBallY + 30;
    }

    this.cannonBallSpeed = 1400;
    this.cannonBallDecelaration = 0;
    this.cannonBallGravity = 1300;

    this.markedForDeletion = false;

    this.speed = masterGameSpeed;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'Black';
    ctx.fill();
  }

  update(deltaTimeInSeconds) {
    this.cannonBallDecelaration += deltaTimeInSeconds * this.cannonBallGravity;
    if (this.facing === 'left') {
      this.x -=
        this.cannonBallSpeed * deltaTimeInSeconds +
        this.speed * deltaTimeInSeconds -
        4;
    } else {
      // it's a right facing cannon
      this.x +=
        this.cannonBallSpeed * deltaTimeInSeconds +
        this.speed * deltaTimeInSeconds -
        4;
    }
    this.y -=
      this.speed * deltaTimeInSeconds +
      this.cannonBallSpeed * deltaTimeInSeconds -
      this.cannonBallDecelaration * deltaTimeInSeconds; // - cannonBallDecelaration;

    // if the ball has gone off the screen bottom delete it from the
    // cannon ball objects array
    if (this.y > canvas.height || this.x < 0 || this.x > canvas.width)
      this.markedForDeletion = true;
  }
}

class Cloud {
  constructor() {
    //this.image = new Image();

    this.random = Math.round(getRandomArbitrary(1, 20));
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === `cloud${this.random}.png`
    ).image;

    this.sX = 0;
    this.sY = 0;
    //this.randomCloudSideValue = +Math.round(Math.random() * 200 + 1);
    this.sWidth = this.image.width;
    this.sHeight = this.image.height;
    this.dX = canvas.width;
    this.dY = Math.round(getRandomArbitrary(0, 150));

    this.randomCloudScaling = getRandomArbitrary(0.8, 1);

    this.dWidth = this.sWidth * this.randomCloudScaling;
    this.dHeight = this.sHeight * this.randomCloudScaling;

    // property of whether this object is marked for deletion or not
    this.markedForDeletion = false;

    // this.speed = Math.round(getRandomArbitrary(70, 100)) + masterGameSpeed;
    this.speedRandomAdjustment = getRandomArbitrary(1, 30);
    this.speed = masterGameSpeed + this.speedRandomAdjustment;
  }

  update(deltaTimeInSeconds) {
    // this.dX -= 5;
    //this.dX -= this.directionX;
    this.dX -= this.speed * deltaTimeInSeconds;

    // mark element in array for deletion so that array doesn't
    // keep building up for elements that aren't on screen any more

    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }
  draw() {
    ctx.drawImage(
      this.image,
      this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place tihe image
      this.dY, // y coord in destination canvas in which to place tihe image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class CollisionDetection {
  constructor() {
    //console.log(collisionDataArray);
    this.collisionDataArray = collisionDataArray;
    // this will be the new landscape colllision array (i.e. only the
    // part of the landscape collusion array that is below the balloon)
    this.newLandcapeCollisionArray;
    // offset for the moving landscape
    this.landscapeOffsetY = 270;
    this.landscapeOffsetX;

    this.landscapeCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'landscape'
    ).data;
    this.balloonCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'balloon'
    ).data;
    this.windTurbineCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'windTurbine'
    ).data;
    this.cannonBallCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'cannonBall'
    ).data;
    this.iceGhostCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'iceGhost'
    ).data;
    this.easterIslandBallCollisionData = this.collisionDataArray.find(
      obj => obj.name === 'easterIslandBall'
    ).data;

    //this.balloonHasCrashed = false;
  }

  _getIntersection(A, B, C, D) {
    function lerp(A, B, t) {
      return A + (B - A) * t;
    }
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom !== 0) {
      const t = tTop / bottom;
      const u = uTop / bottom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
    }
    return false;
  }

  updateLandScapeCollisionArray() {
    // need to find section landcape collision data that is
    // just below the balloon to save processing power
    this.landscapeOffsetX = Math.round(Math.abs(landscapeObjectArray[0].sX));
    // let leftSideOfBalloonX =
    //   Math.round(Math.abs(balloonObjectArray[0].sX)) + this.landscapeOffsetX;
    let rightSideOfBalloonX =
      Math.round(Math.abs(balloonObjectArray[0].dX + 169)) +
      this.landscapeOffsetX;
    const getClosest = (data, target) =>
      data.reduce((acc, obj) =>
        Math.abs(target - obj.x) < Math.abs(target - acc.x) ? obj : acc
      );
    // this could be refactored more but code becomes unreadable when you do imo

    let indexToFind = this.landscapeCollisionData.findIndex(
      e =>
        e.x === getClosest(this.landscapeCollisionData, rightSideOfBalloonX).x
    );

    this.newLandcapeCollisionArray = this.landscapeCollisionData.slice(
      indexToFind - 2,
      indexToFind + 3
    );
  }

  _balloonCrash() {
    // if (balloonExplosionObjectArray.length === 0) {
    // this tells the switch control within the
    // game loop to go into the game over sequence

    gameStatus = 'gameOverExplosion';
    // }
  }
  detectCollisions() {
    // detect when the balloon goes off the screen by 0.5*width (x-axis) or 0.5*height (y-axix)
    if (
      // half of the balloon has gone off the screen to the left
      balloonObjectArray[0].dX < -0.5 * balloonObjectArray[0].sWidth ||
      // half the balloon has gone off the screen to the right
      balloonObjectArray[0].dX + 0.5 * balloonObjectArray[0].sWidth >
        canvas.width ||
      // half the balloon has gone off the top off the screen
      balloonObjectArray[0].dY < -0.5 * balloonObjectArray[0].sHeight
    ) {
      this._balloonCrash();
    }

    // collision detection
    for (let a = 0; a < this.balloonCollisionData.length - 1; a++) {
      let A = {
        x: this.balloonCollisionData[a].x + balloonObjectArray[0].dX,
        y: this.balloonCollisionData[a].y + balloonObjectArray[0].dY,
      };
      let B = {
        x: this.balloonCollisionData[a + 1].x + balloonObjectArray[0].dX,
        y: this.balloonCollisionData[a + 1].y + balloonObjectArray[0].dY,
      };

      // test the landscape collision with the balloon
      // cycle through the parsed landscape data
      for (let b = 0; b < this.newLandcapeCollisionArray.length - 1; b++) {
        let C = {
          x: this.newLandcapeCollisionArray[b].x - this.landscapeOffsetX,
          y: this.newLandcapeCollisionArray[b].y + this.landscapeOffsetY,
        };
        let D = {
          x: this.newLandcapeCollisionArray[b + 1].x - this.landscapeOffsetX,
          y: this.newLandcapeCollisionArray[b + 1].y + this.landscapeOffsetY,
        };

        const I = this._getIntersection(A, B, C, D);

        if (I) {
          //  collision has happened
          this._balloonCrash();
        }
      }

      // test the wind turbine collision with the balloon
      for (let h = 0; h < windTurbineObjectArray.length; h++) {
        //  console.log(cannonBallObjectArray[c].x);
        // now cycle through the cannon ball object array testing
        // for collision (with the balloon())
        for (let j = 0; j < this.windTurbineCollisionData.length - 1; j++) {
          let C = {
            x:
              this.windTurbineCollisionData[j].x + windTurbineObjectArray[h].dX,
            y:
              this.windTurbineCollisionData[j].y + windTurbineObjectArray[h].dY,
          };
          let D = {
            x:
              this.windTurbineCollisionData[j + 1].x +
              windTurbineObjectArray[h].dX,
            y:
              this.windTurbineCollisionData[j + 1].y +
              windTurbineObjectArray[h].dY,
          };

          const I = this._getIntersection(A, B, C, D);
          if (I) {
            //  collision has happened
            this._balloonCrash();
          }
        }
      }
      // test the cannon ball collision with the balloon
      for (let h = 0; h < cannonBallObjectArray.length; h++) {
        //  console.log(cannonBallObjectArray[c].x);
        // now cycle through the cannon ball object array testing
        // for collision (with the balloon())
        for (let j = 0; j < this.cannonBallCollisionData.length - 1; j++) {
          let C = {
            x: this.cannonBallCollisionData[j].x + cannonBallObjectArray[h].x,
            y: this.cannonBallCollisionData[j].y + cannonBallObjectArray[h].y,
          };
          let D = {
            x:
              this.cannonBallCollisionData[j + 1].x +
              cannonBallObjectArray[h].x,
            y:
              this.cannonBallCollisionData[j + 1].y +
              cannonBallObjectArray[h].y,
          };

          const I = this._getIntersection(A, B, C, D);
          if (I) {
            //  collision has happened
            this._balloonCrash();
          }
        }
      }

      // detect collision of the balloon with the shark laser eyes
      // Shark laser eyes
      for (let h = 0; h < sharkLaserObjectArray.length; h++) {
        // there's two lasers, one for each eye
        for (let eye = 1; eye <= 2; eye++) {
          if (eye === 1) {
            // first eye laser
            let C = {
              x: sharkLaserObjectArray[h].laser1BeginX,
              y: sharkLaserObjectArray[h].laser1BeginY,
            };

            let D = {
              x: sharkLaserObjectArray[h].laser1EndX,
              y: sharkLaserObjectArray[h].laser1EndY,
            };

            const I = this._getIntersection(A, B, C, D);
            if (I) {
              //  collision has happened
              this._balloonCrash();
            }
          } else {
            // second eye laser
            let C = {
              x: sharkLaserObjectArray[h].laser2BeginX,
              y: sharkLaserObjectArray[h].laser2BeginY,
            };

            let D = {
              x: sharkLaserObjectArray[h].laser2EndX,
              y: sharkLaserObjectArray[h].laser2EndY,
            };
            const I = this._getIntersection(A, B, C, D);
            if (I) {
              //  collision has happened
              this._balloonCrash();
            }
          }
        }
      }

      // detect the iceGhost collision data with balloon
      for (let h = 0; h < iceGhostObjectArray.length; h++) {
        for (let j = 0; j < this.iceGhostCollisionData.length - 1; j++) {
          let C = {
            x: this.iceGhostCollisionData[j].x + iceGhostObjectArray[h].dX,
            y: this.iceGhostCollisionData[j].y + iceGhostObjectArray[h].dY,
          };
          let D = {
            x: this.iceGhostCollisionData[j + 1].x + iceGhostObjectArray[h].dX,
            y: this.iceGhostCollisionData[j + 1].y + iceGhostObjectArray[h].dY,
          };

          const I = this._getIntersection(A, B, C, D);
          if (I) {
            //  collision has happened
            this._balloonCrash();
          }
        }
      }
      // detect collision of easter island balls with balloon
      for (let h = 0; h < easterIslandBallObjectArray.length; h++) {
        //  console.log(cannonBallObjectArray[c].x);
        // now cycle through the cannon ball object array testing
        // for collision (with the balloon())
        for (
          let j = 0;
          j < this.easterIslandBallCollisionData.length - 1;
          j++
        ) {
          let C = {
            x:
              this.easterIslandBallCollisionData[j].x +
              easterIslandBallObjectArray[h].dX,
            y:
              this.easterIslandBallCollisionData[j].y +
              easterIslandBallObjectArray[h].dY,
          };
          let D = {
            x:
              this.easterIslandBallCollisionData[j + 1].x +
              easterIslandBallObjectArray[h].dX,
            y:
              this.easterIslandBallCollisionData[j + 1].y +
              easterIslandBallObjectArray[h].dY,
          };

          const I = this._getIntersection(A, B, C, D);
          if (I) {
            //  collision has happened
            this._balloonCrash();
          }
        }
      }

      // collision with coins
      // each coin object has it's own collision data attached to it
      for (let g = 0; g < goldenCoinObjectArray.length; g++) {
        // we are now cycling through ech golden coin object
        // console.log(goldenCoinObjectArray[e]);
        for (
          let h = 0;
          h < goldenCoinObjectArray[g].collisionArray.length - 1;
          h++
        ) {
          //console.log(goldenCoinObjectArray[e].collisionArray.length);
          let C = {
            x:
              goldenCoinObjectArray[g].collisionArray[h].x +
              goldenCoinObjectArray[g].dX,
            y:
              goldenCoinObjectArray[g].collisionArray[h].y +
              goldenCoinObjectArray[g].dY,
          };
          let D = {
            x:
              goldenCoinObjectArray[g].collisionArray[h + 1].x +
              goldenCoinObjectArray[g].dX,
            y:
              goldenCoinObjectArray[g].collisionArray[h + 1].y +
              goldenCoinObjectArray[g].dY,
          };
          const I = this._getIntersection(A, B, C, D);
          if (I) {
            //  collision.play();
            // we've hit a golden coin so update the...
            //flag the coin that has been hit
            goldenCoinObjectArray[g].thisCoinHasBeenHit = true;
            // flag all the other coins to make them dissapear
            goldenCoinObjectArray.forEach((element, index) => {
              if (index !== g) element.fadeOutThisCoin = true;
            });
          }
        }
      }
    }
  }

  draw() {
    // draw the landscape collision data
    collisionCtx.beginPath();
    collisionCtx.moveTo(
      this.newLandcapeCollisionArray[0].x - this.landscapeOffsetX,
      this.newLandcapeCollisionArray[0].y + this.landscapeOffsetY
    );
    for (let p = 1; p < this.newLandcapeCollisionArray.length - 1; p++) {
      collisionCtx.lineTo(
        this.newLandcapeCollisionArray[p].x - this.landscapeOffsetX,
        this.newLandcapeCollisionArray[p].y + this.landscapeOffsetY
      );
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }

    // draw the balloon collision data
    collisionCtx.beginPath();
    collisionCtx.moveTo(
      this.balloonCollisionData[0].x + balloonObjectArray[0].dX,
      this.balloonCollisionData[0].y + balloonObjectArray[0].dY
    );
    for (let p = 1; p < this.balloonCollisionData.length - 1; p++) {
      collisionCtx.lineTo(
        this.balloonCollisionData[p].x + balloonObjectArray[0].dX,
        this.balloonCollisionData[p].y + balloonObjectArray[0].dY
      );
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }

    // draw the wind turbine collision data
    // draw wind turbine collision data
    for (let j = 0; j < windTurbineObjectArray.length; j++) {
      collisionCtx.beginPath();
      collisionCtx.moveTo(
        this.windTurbineCollisionData[0].x + windTurbineObjectArray[j].dX,
        this.windTurbineCollisionData[0].y + windTurbineObjectArray[j].dY
      );
      for (let l = 1; l < this.windTurbineCollisionData.length; l++) {
        collisionCtx.lineTo(
          this.windTurbineCollisionData[l].x + windTurbineObjectArray[j].dX,
          this.windTurbineCollisionData[l].y + windTurbineObjectArray[j].dY
        );
      }
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }

    // draw the cannon ball collision data
    for (let j = 0; j < cannonBallObjectArray.length; j++) {
      collisionCtx.beginPath();
      collisionCtx.moveTo(
        this.cannonBallCollisionData[0].x + cannonBallObjectArray[j].x,
        this.cannonBallCollisionData[0].y + cannonBallObjectArray[j].y
      );
      for (let l = 1; l < this.cannonBallCollisionData.length; l++) {
        collisionCtx.lineTo(
          this.cannonBallCollisionData[l].x + cannonBallObjectArray[j].x,
          this.cannonBallCollisionData[l].y + cannonBallObjectArray[j].y
        );
      }
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }

    // draw the iceghost collision data
    for (let j = 0; j < iceGhostObjectArray.length; j++) {
      collisionCtx.beginPath();
      collisionCtx.moveTo(
        this.iceGhostCollisionData[0].x + iceGhostObjectArray[j].dX,
        this.iceGhostCollisionData[0].y + iceGhostObjectArray[j].dY
      );
      for (let l = 1; l < this.iceGhostCollisionData.length; l++) {
        collisionCtx.lineTo(
          this.iceGhostCollisionData[l].x + iceGhostObjectArray[j].dX,
          this.iceGhostCollisionData[l].y + iceGhostObjectArray[j].dY
        );
      }
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }

    // draw the easter island ball collision data
    for (let j = 0; j < easterIslandBallObjectArray.length; j++) {
      collisionCtx.beginPath();
      collisionCtx.moveTo(
        this.easterIslandBallCollisionData[0].x +
          easterIslandBallObjectArray[j].dX,
        this.easterIslandBallCollisionData[0].y +
          easterIslandBallObjectArray[j].dY
      );
      for (let l = 1; l < this.easterIslandBallCollisionData.length; l++) {
        collisionCtx.lineTo(
          this.easterIslandBallCollisionData[l].x +
            easterIslandBallObjectArray[j].dX,
          this.easterIslandBallCollisionData[l].y +
            easterIslandBallObjectArray[j].dY
        );
      }
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }
    ///
    // draw the golden coins
    for (let c = 0; c < goldenCoinObjectArray.length; c++) {
      // we are now cycling through ech golden coin object

      collisionCtx.beginPath();
      collisionCtx.moveTo(
        goldenCoinObjectArray[c].collisionArray[0].x +
          goldenCoinObjectArray[c].dX,
        goldenCoinObjectArray[c].collisionArray[0].y +
          goldenCoinObjectArray[c].dY
      );
      for (let h = 1; h < goldenCoinObjectArray[c].collisionArray.length; h++) {
        collisionCtx.lineTo(
          goldenCoinObjectArray[c].collisionArray[h].x +
            goldenCoinObjectArray[c].dX,
          goldenCoinObjectArray[c].collisionArray[h].y +
            goldenCoinObjectArray[c].dY
        );
      }
      collisionCtx.strokeStyle = 'Black';
      collisionCtx.lineWidth = 20;
      collisionCtx.stroke();
    }
  }
}

class EasterIsland {
  constructor() {
    // this.easterIslandImage = preLoadedImageArray[30].image;
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'easterIslandSpriteSheet.png'
    ).image;

    this.frame = 1;

    this.easterIslandSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'easterIslandSpriteXYArray'
    ).array;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 207.5; //398.5
    this.sHeight = 459; //585.6

    this.dWidth = this.sWidth / 1.4;
    this.dHeight = this.sHeight / 1.4;
    this.dX = canvas.width;
    // randomise y position of iceGhosts
    this.dY = canvas.height - 50 - this.dHeight;

    this.delayToMouthOpenTimer = 0;
    this.delayUntilMouthOpen = 3; // seceonds

    this.delayToMouthCloseTimer = 0;
    this.delayUntilMouthClose = 4; // seceonds

    this.speed = masterGameSpeed;
    this.mouthCycleFinished = false;

    this.markedForDeletion = false;
  }

  update(deltaTimeInSeconds) {
    this.delayToMouthOpenTimer += deltaTimeInSeconds;
    if (
      this.delayToMouthOpenTimer > this.delayUntilMouthOpen &&
      !this.mouthCycleFinished
    ) {
      // mouth open
      this.frame = 0;

      // create an Easter Island Ball object

      if (
        this.delayToMouthOpenTimer.toFixed(2) %
          Math.round(getRandomArbitrary(0.4, 2.1)) ===
        0
      )
        easterIslandBallObjectArray.push(
          new EasterIslandBall(this.dX + 10, this.dY + 150)
        );

      this.delayToMouthCloseTimer += deltaTimeInSeconds;
      if (this.delayToMouthCloseTimer > this.delayUntilMouthClose) {
        // mouth closed
        this.frame = 1;
        this.mouthCycleFinished = true;
      }
    }

    this.dX -= this.speed * deltaTimeInSeconds;

    // delete object from array if off screen

    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.easterIslandSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.easterIslandSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class EasterIslandBall {
  constructor(x, y) {
    // play one of the 6 sound files for this iceGhost
    this.soundNumber = Math.round(getRandomArbitrary(1, 5));
    this.easterIslandBallSound = soundsArray
      .find(e => e.name === `pop${this.soundNumber}Sound`)
      .sound.play();

    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'easterIslandBall.png'
    ).image;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 72;
    this.sHeight = 72;

    this.dX = x;
    this.dY = y;
    this.dWidth = this.sWidth / 1.4;
    this.dHeight = this.sHeight / 1.4;

    this.travelOutOfMouthTimer = 0;
    this.travelOutOfMouth = 2.5;

    this.speed = 70 + masterGameSpeed;

    this.startingBallAlpha = 0;

    this.markedForDeletion = false;
  }

  update(deltaTimeInSeconds) {
    this.travelOutOfMouthTimer -= deltaTimeInSeconds;
    //console.log(this.travelOutOfMouthTimer.toFixed(1));

    this.dX -= this.speed * deltaTimeInSeconds + 2;
    this.dY += this.travelOutOfMouthTimer * 80 * deltaTimeInSeconds;

    this.startingBallAlpha++;

    // mark easterIslandBall for deletion
    if (this.dX < 0 - this.sWidth || this.dY < 0) this.markedForDeletion = true;
  }
  draw(deltaTimeInSeconds) {
    ctx.save();
    ctx.globalAlpha = (this.startingBallAlpha * deltaTimeInSeconds) / 1.5;
    ctx.drawImage(
      this.image,
      this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
    ctx.restore();
  }
}

class GameOver {
  constructor() {
    this.text = 'GAME OVER!';
    this.subText = 'Press Space Bar to try again';

    this.textGrow = 0;
    this.textGrowRate = 0.01;
    this.fontSize = 0;

    this.maxfontSize = 240;
  }

  update(deltaTimeInSeconds) {
    //console.log(deltaTimeInSeconds);
    this.textGrow += deltaTimeInSeconds;
    if (
      this.textGrow > this.textGrowRate &&
      this.fontSize !== this.maxfontSize
    ) {
      this.fontSize += 5;
      this.textGrow = 0;
    }
    if (this.fontSize === this.maxfontSize) console.log('done');
  }
  draw() {
    ctx.fillStyle = 'black';
    ctx.font = `${this.fontSize}px Impact`;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, canvas.width / 2, 500);

    ctx.fillStyle = 'black';
    ctx.font = `${this.fontSize / 3}px Impact`;
    ctx.textAlign = 'center';
    ctx.fillText(this.subText, canvas.width / 2, 600);
  }
}

class YouWin {
  constructor() {
    this.text = 'Well done. You made it!!';
    this.subText = `You scored ${scoreObjectArray[0].score}`;
    this.spaceText = `Please press the Space Bar to play again`;

    this.textGrow = 0;
    this.textGrowRate = 0.002;
    this.fontSize = 0;

    this.maxfontSize = 150;
  }

  update(deltaTimeInSeconds) {
    //console.log(deltaTimeInSeconds);
    this.textGrow += deltaTimeInSeconds;
    if (
      this.textGrow > this.textGrowRate &&
      this.fontSize !== this.maxfontSize
    ) {
      this.fontSize += 1;
      this.textGrow = 0;
    }
    if (this.fontSize === this.maxfontSize) console.log('done');
  }
  draw() {
    ctx.fillStyle = 'black';
    ctx.font = `${this.fontSize}px Impact`;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, canvas.width / 2, 500);

    ctx.fillStyle = 'black';
    ctx.font = `${this.fontSize / 1.5}px Impact`;
    ctx.textAlign = 'center';
    ctx.fillText(this.subText, canvas.width / 2, 600);

    ctx.fillStyle = 'black';
    ctx.font = `${this.fontSize / 2.5}px Impact`;
    ctx.textAlign = 'center';
    ctx.fillText(this.spaceText, canvas.width / 2, 670);
  }
}

class GoldenCoin {
  constructor(randomNumber) {
    // get random coin image
    this.randomNumber = randomNumber; //Math.round(getRandomArbitrary(1, 10));

    this.image = preLoadedImageArray.find(
      obj => obj.imageName === `${this.randomNumber}Coin.png`
    ).image;

    this.goldenCoinSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'goldenCoinSpriteXYArray'
    ).array;

    this.collectCoinSound = soundsArray.find(
      e => e.name === 'collectCoinSound'
    ).sound;

    this.wrongAnswer = soundsArray.find(e => e.name === 'wrongAnswer').sound;

    this.correctAnswer = soundsArray.find(
      e => e.name === 'correctAnswer'
    ).sound;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 118;
    this.sHeight = 120;

    this.frame = 0;
    this.maxFrame = 31;

    this.markedForDeletion = false;
    // random position on the X axis between 0 and canvas width
    // let coinObjectCount = goldenCoinObjectArray.length;
    // console.log('-------------', coinObjectCount);
    let foundValue = false;
    while (!foundValue) {
      let randomXValue = Math.round(getRandomArbitrary(150, canvas.width));
      // console.log('randomXValue=', randomXValue);
      let foundAnswer = goldenCoinObjectArray.find(
        e =>
          (randomXValue > balloonObjectArray[0].dX - 200 &&
            randomXValue < balloonObjectArray[0].dX + 400) ||
          (randomXValue > e.dX - 100 && randomXValue < e.dX + 100)
      );
      if (foundAnswer === undefined) {
        this.dX = randomXValue;
        foundValue = true;
        break;
      }
    }
    // let randomXValue = getRandomArbitrary(
    //   balloonObjectArray[0].dX + balloonObjectArray[0].sWidth * 2,
    //   canvas.width
    // );
    // this.dX = randomXValue;
    // random position on the Y axis between 0 and 700
    this.dY = Math.round(getRandomArbitrary(0, 700)); // 0 to 700

    this.dWidth = this.sWidth;
    this.dHeight = this.sHeight;

    /////////////////////////////
    // Coin Collision
    // Attach a coin collision array to THIS object, this will
    // allow us to easily identify WHICH coin has been hit by
    // the balloon
    this.collisionArray = collisionDataArray.find(
      obj => obj.name === 'coin'
    ).data;
    /////////////////////////////
    // coin scrolling and animation
    this.speed = masterGameSpeed;

    this.animationCount = 0;
    this.animationSpeed = 0.05;

    // this is flagged as true when the balloon hits THIS coin and
    // will then be dealt with in the game loop - the flag is changed in the collision detection
    this.coinHasBeenHit = false;
    // this flag will tell the game loop to fade out all the other coins on the screen.
    // This flag is changed in the game loop
    this.fadeOutThisCoin = false;

    // how fast do the other coind shrink when one coin has been hit by the balloon
    this.shrinkRate = 0.9;

    // target of where we want the coin to move to ( just after the = sign)
    this.targetX = 335;
    this.targetY = 10;
    this.movingCoinToTarget = 0;

    // time to process the maths problem
    this.timeToProcessMathAnswerCount = 0;
    this.timeToProcessMathAnswer = 2;
  }

  update(deltaTimeInSeconds) {
    // spinning golden coin
    this.animationCount += deltaTimeInSeconds;
    if (this.animationCount > this.animationSpeed) {
      if (this.frame === this.maxFrame - 1) this.frame = 0;
      else this.frame++;
      this.animationCount = 0;
    }

    // x movement of golden coin
    this.dX -= this.speed * deltaTimeInSeconds;
    // delete if the golden coin goes off the screen to the left
    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }

  _getPositionAlongTheLine(x1, y1, x2, y2, percentage) {
    return {
      x: x1 * (1.0 - percentage) + x2 * percentage,
      y: y1 * (1.0 - percentage) + y2 * percentage,
    };
  }
  moveCoinToAnswerArea(deltaTimeInSeconds) {
    // // we want the coin to move to
    // if (this.thiscoinHasBeenHit === false) return;

    let xy = this._getPositionAlongTheLine(
      this.dX,
      this.dY,
      this.targetX,
      this.targetY,
      0.2
    );

    this.dX = Math.round(xy.x);
    this.dY = Math.round(xy.y);

    // is the answer correct?
    if (this.timeToProcessMathAnswerCount === 0) {
      this.collectCoinSound.play();
    }
    this.timeToProcessMathAnswerCount += deltaTimeInSeconds;
    if (this.timeToProcessMathAnswerCount > this.timeToProcessMathAnswer) {
      if (this.randomNumber === mathChallengeObjectArray[0].mathAnswer) {
        console.log('YEAH!');
        // score += 1;
        scoreObjectArray[0].score += 1;

        this.correctAnswer.play();
        // the answer has been processed
        //  answerBeingProcessed = false;
        // remove the current maths problem
        mathChallengeObjectArray.splice(0, mathChallengeObjectArray.length);
        // remove the coin that is placed in the answer box
        goldenCoinObjectArray.splice(0, goldenCoinObjectArray.length);
      } else {
        console.log('No!');
        // score -= 1;
        this.wrongAnswer.play();
        // the answer has been processed
        // answerBeingProcessed = false;
        // remove the current maths problem
        // mathChallengeObjectArray = [];
        mathChallengeObjectArray.splice(0, mathChallengeObjectArray.length);
        // remove the coin that is placed in the answer box
        // goldenCoinObjectArray = [];
        goldenCoinObjectArray.splice(0, goldenCoinObjectArray.length);
      }
    }
  }

  draw() {
    // if (this.markedForDeletion) return;
    ctx.drawImage(
      this.image,
      this.goldenCoinSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.goldenCoinSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      //this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      //this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place tihe image
      this.dY, // y coord in destination canvas in which to place tihe image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }

  fadeOut(deltaTimeInSeconds) {
    // we want to shrink the coins to nothing
    // this.dWidth = this.dWidth * this.shrinkRate;
    this.dHeight = this.dHeight * this.shrinkRate;
    this.dY = this.dY + this.shrinkRate;
    this.dWidth = this.dWidth * this.shrinkRate;
    this.dX = this.dX + this.shrinkRate;

    // remove this collision array from the object as it's not needed any more
    this.collisionArray = [{ x: '', y: '' }];
    // delete this coin object when it's shrunk to zero
    // console.log(Math.floor(this.dHeight));
    if (Math.floor(this.dHeight) === 0) this.markedForDeletion = true;
  }
}

class IceGhost {
  constructor() {
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'iceGhostSpriteSheet.png'
    ).image;

    //this.iceGhostImage = preLoadedImageArray[29].image;
    this.frame = 0;
    this.maxFrame = 10;

    this.iceGhostSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'iceGhostSpriteXYArray'
    ).array;

    // play one of the 6 sound files for this iceGhost
    this.soundNumber = Math.round(getRandomArbitrary(1, 6));
    this.iceGhostSound = soundsArray
      .find(e => e.name === `halloweenGhost${this.soundNumber}Sound`)
      .sound.play();

    // this.soundNumber = Math.round(getRandomArbitrary(0, 5));

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 399; //398.5
    this.sHeight = 586; //585.6
    this.dX = canvas.width;
    // randomise y position of iceGhosts
    this.dY = Math.round(getRandomArbitrary(50, 600));
    this.dWidth = this.sWidth / 3;
    this.dHeight = this.sHeight / 3;

    // recommended by creator = 30 fps
    // therefore 1/30 = 0.033
    this.timeSinceLastIceGhost = 0;
    this.iceGhostAnimationSpeed = 0.033;

    // y axis speed
    this.speed = masterGameSpeed;
    // y axis random speed adjuster
    this.randomSpeedAdjuster = Math.round(getRandomArbitrary(0, 50));

    // marked for deletion
    this.markedForDeletion = false;
  }

  update(deltaTimeInSeconds) {
    this.timeSinceLastIceGhost += deltaTimeInSeconds;
    if (this.timeSinceLastIceGhost > this.iceGhostAnimationSpeed) {
      if (this.frame === this.maxFrame) this.frame = 0;
      else this.frame++;
      this.timeSinceLastIceGhost = 0;
    }
    // // x axis movment
    this.dX -= (this.speed + this.randomSpeedAdjuster) * deltaTimeInSeconds;
    // mark for deletion when off screen
    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }
  draw() {
    // console.log(this.frame, this.frame);
    ctx.drawImage(
      this.image,
      this.iceGhostSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.iceGhostSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class Landscape {
  constructor() {
    this.lifeIsBeautifulSound = soundsArray
      .find(e => e.name === 'lifeIsBeautifulSound')
      .sound.play();

    // landscape image
    // let image = new Image();
    // image.src = '/images/land.png';
    // this.image = image;

    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'land.png'
    ).image;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 1920; //1920
    this.sHeight = 490; // 816

    this.dX = this.sX;
    this.dY = canvas.height - this.sHeight;
    this.dWidth = canvas.width; //canvas.width
    this.dHeight = 490; // 816

    // landscape animation
    this.speed = masterGameSpeed;
  }
  update(deltaTimeInSeconds) {
    // console.log('====', this.timeCount);
    // we want the landscape to run at
    this.sX += this.speed * deltaTimeInSeconds;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class LandscapeWater {
  constructor() {
    // this.image = preLoadedImageArray[27].image;
    // landscape image
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'landWater.png'
    ).image;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 1932;
    this.sHeight = 178;
    this.dX = 0;
    this.dY = canvas.height - 178;
    this.dWidth = canvas.width;
    this.dHeight = 178;

    this.speed = masterGameSpeed;
  }

  update(deltaTimeInSeconds) {
    this.sX += this.speed * deltaTimeInSeconds;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class MathChallenge {
  constructor(gameAnswer = '__') {
    this.aValue = Math.round(getRandomArbitrary(1, 9)); // value 1 to 8
    this.bValue = Math.round(getRandomArbitrary(1, 10 - this.aValue));
    this.mathAnswer = this.aValue + this.bValue;
    this.gameAnswer = gameAnswer;

    this.mathProblemScroll = -500;

    this.markedForDeletion = false;
  }

  draw(deltaTimeInSeconds) {
    if (this.mathProblemScroll < 50)
      this.mathProblemScroll += deltaTimeInSeconds * 700;

    // Math Challenge
    ctx.fillStyle = 'black';
    ctx.font = '100px Impact';
    ctx.fillText(
      `${this.aValue} + ${this.bValue} = ${this.gameAnswer}`,
      Math.floor(this.mathProblemScroll),
      120
    );
    ctx.fillStyle = 'white';
    ctx.font = '100px Impact';
    ctx.fillText(
      `${this.aValue} + ${this.bValue} = ${this.gameAnswer}`,
      Math.floor(this.mathProblemScroll) + 5,
      125
    );
  }
}

class Score {
  constructor() {
    this.score = 0;
  }

  draw() {
    // Score Challenge
    ctx.fillStyle = 'black';
    ctx.fillText(`Score = ${this.score}`, 1450, 120); //1450
    ctx.fillStyle = 'white';
    ctx.fillText(`Score = ${this.score}`, 1450, 125);
  }
}

class SharkFin {
  constructor(leftRightFace) {
    if (leftRightFace === 'left') {
      this.facing = 'left';
      this.image = preLoadedImageArray.find(
        obj => obj.imageName === 'sharkFinSpriteSheetLeft.png'
      ).image;
      //  this.sharkFinImage = preLoadedImageArray[25].image;
    } else {
      this.facing = 'right';
      this.image = preLoadedImageArray.find(
        obj => obj.imageName === 'sharkFinSpriteSheetRight.png'
      ).image;
      // this.sharkFinImage = preLoadedImageArray[26].image;
    }

    // get the cannon sprite sheet array
    this.sharkFinSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'sharkFinSpriteXYArray'
    ).array;

    this.frame = 0;
    // maximum frames is 27, so we're randomizing how high
    // the fin comes out of the water
    this.maxFrame = Math.round(getRandomArbitrary(18, 27));

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 340;
    this.sHeight = 60;
    this.dWidth = this.sWidth;
    this.dHeight = this.sHeight;
    this.dX = canvas.width;

    this.upDownRepeat = 0;
    // note, the water depth needs to be 218 pixels on the landscape
    // here the shark fins will be positions randomly from 218 to 50
    // ... 218 is on the top of the water

    this.dY =
      canvas.height -
      Math.round(getRandomArbitrary(100, 178)) - // 100 178
      this.sHeight +
      4; //120 280

    this.finAnimationSpeed = 0.1;
    this.timeSinceLastFinInterval = 0;

    this.upFinPause = 0;

    this.upDownCount = 0;

    this.markedForDeletion = false;

    this.speed = masterGameSpeed;
    // fin movement in the y-axis needs to be faster than the
    // y scroll of the landscape (which is 70). Here we're
    // setting the speed of y-axis movement to between 120 and 160

    this.finMovementXSpeed = Math.round(getRandomArbitrary(0.5, 1.2));

    this.direction = 'up';
  }

  update(deltaTimeInSeconds) {
    this.timeSinceLastFinInterval += deltaTimeInSeconds;
    //fin frame animation
    if (
      this.timeSinceLastFinInterval >
      this.finAnimationSpeed + this.upFinPause
    ) {
      //console.log('fin frame=', this.frame);
      this.upFinPause = 0;
      if (this.frame === 0) {
        this.upDownCount++;
        this.direction = 'up';
        this.upDownRepeat++;
      }

      if (this.direction === 'up') {
        this.frame++;
      } else {
        this.frame--;
      }

      if (this.frame === this.maxFrame) {
        this.direction = 'down';
        this.upFinPause = Math.round(getRandomArbitrary(1, 5));
      }

      this.timeSinceLastFinInterval = 0;
    }
    // shar fin horizontal movement (x axis)
    if (this.facing === 'left') {
      // swim to the left on the x axis
      this.dX -= this.speed * deltaTimeInSeconds + this.finMovementXSpeed; // - this.finMovementYSpeed; // 2 is too slow
      // console.log('----------------left ', this.sharkFin_dX);
    } else {
      // swim to the right on the x axis
      this.dX -= this.speed * deltaTimeInSeconds - this.finMovementXSpeed; // + this.finMovementYSpeed; // 2 is too slow
      //  console.log('----------------right ', this.sharkFin_dX);
    }

    // when this shark has gone up and down between 4 and 9 times, set it for deletion
    if (this.dX < 0 - this.sWidth || this.upDownCount === 3)
      this.markedForDeletion = true;
  }
  draw() {
    ctx.drawImage(
      this.image,
      this.sharkFinSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sharkFinSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class SharkHead {
  constructor() {
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'sharkHeadSpriteSheet.png'
    ).image;

    this.sharkHeadSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'sharkHeadSpriteXYArray'
    ).array;

    this.frame = 0;
    this.maxFrame = 30;
    this.pauseFrames = 0;

    this.sX = 0;
    this.sY = 0;
    this.sWidth = 206;
    this.sHeight = 120;

    this.dX = canvas.width;
    this.dY = canvas.height - this.sHeight - 176;
    this.dWidth = this.sWidth;
    this.dHeight = this.sHeight;

    this.timeSinceLastHeadInterval = 0;
    this.sharkHeadAnimationFrameTime = 0.03;

    this.speed = masterGameSpeed;

    this.finUp;

    this.upDownCycleCompleted = false;

    this.pauseHeadAtTop = 90;

    // wiat 3 to 10 seconds before the the shark head appears
    this.pauseBeforeSharkAppears = Math.round(getRandomArbitrary(2, 10));
    this.haveWePausedLongEnough = false;

    this.markedForDeletion = false;
  }

  update(deltaTimeInSeconds) {
    this.timeSinceLastHeadInterval += deltaTimeInSeconds;
    if (
      this.timeSinceLastHeadInterval > this.pauseBeforeSharkAppears &&
      !this.haveWePausedLongEnough
    )
      this.haveWePausedLongEnough = true;

    if (
      this.timeSinceLastHeadInterval > this.sharkHeadAnimationFrameTime &&
      !this.upDownCycleCompleted &&
      this.haveWePausedLongEnough
    ) {
      if (this.frame === this.maxFrame) {
        this.finUp = false;
        this.pauseFrames++;

        // call the laser effect!
        if (!this.laserRayObjectCreated) {
          sharkLaserObjectArray.push(
            new SharkHeadLaserEyes(
              this.dX + 82,
              this.dY + 42,

              this.dX + 82,
              this.dY + 42,
              this.pauseHeadAtTop
            )
          );
          this.laserRayObjectCreated = true;
        }
      }
      if (this.frame === 0) {
        this.finUp = true;
        this.pauseFrames = 0;
      }

      if (this.finUp === true) {
        this.frame++;
      } else {
        if (this.pauseFrames === this.pauseHeadAtTop) {
          this.frame--;
          if (this.frame === 0) this.upDownCycleCompleted = true;
        }
      }

      this.timeSinceLastHeadInterval = 0;

      if (this.frame === 0) this.markedForDeletion = true;
      //  this.sharkHead_dX = canvas.width - 500;
    }

    // update on the y axis
    this.dX -= this.speed * deltaTimeInSeconds;
  }

  draw() {
    // console.log(this.frame, this.frame);
    ctx.drawImage(
      this.image,
      this.sharkHeadSpriteXYArray[this.frame].x, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sharkHeadSpriteXYArray[this.frame].y, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

class SharkHeadLaserEyes {
  constructor(x1, y1, x2, y2, laserTiming) {
    //this.laserSound = laserSound.play();

    this.laserSound = soundsArray
      .find(e => e.name === 'laserSound')
      .sound.play();

    this.laser1BeginX = x1;
    this.laser1BeginY = y1;
    this.laser1EndX = x1; //canvas.width / Math.round(getRandomArbitrary(2, 3));
    this.laser1EndY = 0;

    this.laser2BeginX = x2;
    this.laser2BeginY = y2;
    this.laser2EndX = x2; //canvas.width / Math.round(getRandomArbitrary(2, 3));
    this.laser2EndY = 0;

    this.timeSinceLastLaserMovement = 0;
    this.laserMovementInterval = 3.3;

    this.laserRayObjectCreated = false;
    this.speed = masterGameSpeed;

    // this is the time of the pause when teh
    // sharks head comes out of the water.
    // we only want the laser going whilst it's at the top
    this.timeSinceLastLaser = 0;
    this.laserTimer = laserTiming * 0.03;

    this.markedForDeletion = false;
  }

  draw() {
    ctx.save();
    ctx.beginPath();
    ctx.shadowBlur = Math.round(getRandomArbitrary(0, 30)); // integer

    ctx.moveTo(this.laser1BeginX, this.laser1BeginY);
    ctx.lineTo(this.laser1EndX, this.laser1EndY);

    //ctx.stroke();

    ctx.moveTo(this.laser2BeginX, this.laser2BeginY);
    ctx.lineTo(this.laser2EndX, this.laser2EndY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;

    ctx.shadowColor = 'red'; // string
    // //Color of the shadow;  RGB, RGBA, HSL, HEX, and other inputs are valid.
    ctx.shadowOffsetX = 0; // integer
    // //Horizontal distance of the shadow, in relation to the text.
    ctx.shadowOffsetY = 0; // integer
    // //Vertical distance of the shadow, in relation to the text.
    // //Blurring effect to the shadow, the larger the value, the greater the blur.
    ctx.stroke();
    ctx.restore();
  }

  update(deltaTimeInSeconds) {
    this.timeSinceLastLaserMovement += deltaTimeInSeconds;
    this.timeSinceLastLaser += deltaTimeInSeconds;
    if (this.timeSinceLastLaserMovement > this.laserMovementInterval) {
      //ctx.lineTo(this.laser1EndX - 1, this.laser1EndY);
      this.timeSinceLastLaserMovement = 0;
    }
    if (this.timeSinceLastLaser > this.laserTimer) {
      // delete the laser if the sharks head it about to go down
      this.markedForDeletion = true;
    }

    // move the laser from eye with the scenary (so it stays at the eye point)
    this.laser1BeginX -= this.speed * deltaTimeInSeconds;
    this.laser1EndX += this.speed * deltaTimeInSeconds;

    this.laser2BeginX -= this.speed * deltaTimeInSeconds;
    this.laser2EndX -= 2 * this.speed * deltaTimeInSeconds;
  }
}

class WindTurbine {
  constructor() {
    this.image = preLoadedImageArray.find(
      obj => obj.imageName === 'windTurbineSpriteSheet.png'
    ).image;

    // get the sprite sheet array
    this.windTurbineSpriteXYArray = spriteSheetArrays.find(
      obj => obj.name === 'windTurbineSpriteXYArray'
    ).array;

    // animating the sprite frames
    this.frame = 0;
    this.maxFrame = 11;

    // sprite width 2861 x 371
    // 13 images: 2861/13 = 220.07 = 220.1 width
    // 1px black border around each image
    this.sWidth = 420; //420
    this.sHeight = 682; //682

    this.sX = 0;
    this.sY = 0;

    //this.dY = canvas.height - Math.round(getRandomArbitrary(100, 165));
    this.dWidth = this.sWidth / 1.1; /// 1.5;
    this.dHeight = this.sHeight / 1.1; // / 1.5;

    // we need to postion these on the landscape
    // but for the moment we'll just put on in the sky
    // this.dX = this.dWidth;
    this.dX = canvas.width;
    this.dY = canvas.height - this.dHeight - 200; //200

    // movement on the x-axis
    this.speed = masterGameSpeed;

    // dealing with the rotation movement
    this.timeSinceLastRotation = 0;
    //  time between rotation frames (0.01 to 0.06 seconds)
    this.rotationInterval = Math.round(getRandomArbitrary(0.01, 0.06));

    // property of whether this object is marked for deletion or not
    this.markedForDeletion = false;

    this.quintTimer = 0;
  }

  update(deltaTimeInSeconds) {
    // making sure turbines spin on slow and fast computers
    this.timeSinceLastRotation += deltaTimeInSeconds;

    if (this.timeSinceLastRotation > this.rotationInterval) {
      if (this.frame === this.maxFrame) this.frame = 0;
      else this.frame++;
      this.timeSinceLastRotation = 0;
    }
    // x axis movment
    this.dX -= this.speed * deltaTimeInSeconds;

    this.quintTimer += deltaTimeInSeconds;

    this.dY = 100 * Math.sin(0.4 * Math.PI * this.quintTimer) + 400;

    if (this.dX < 0 - this.sWidth) this.markedForDeletion = true;
  }

  draw() {
    ctx.drawImage(
      this.image,
      //this.sX * this.frame, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      //this.sX, //The x-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.windTurbineSpriteXYArray[this.frame].x,

      this.sY, //The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
      this.sWidth, //The width of the sub-rectangle of the source image to draw into the destination context.
      this.sHeight,
      this.dX, // x coord in destination canvas in which to place the image
      this.dY, // y coord in destination canvas in which to place the image
      this.dWidth, //The width to draw the image in the destination canvas.
      this.dHeight //The height to draw the image in the destination canvas.
    );
  }
}

//////////////////////////////////////////////
/////// GAME LOOP ////////////////////////////
function animate(timeStamp = 0) {
  // guard clause
  if (!gameInitialised) return;

  // create deltaTime so animation runs based on time
  deltaTimeInSeconds = (timeStamp - oldTimeStamp) / 1000;
  oldTimeStamp = timeStamp;
  accumulativeDeltaTimeInSeconds += deltaTimeInSeconds;

  //console.log(deltaTimeInSeconds);

  // Limit the time skip
  deltaTimeInSeconds = Math.min(deltaTimeInSeconds, 0.1);
  // clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  collisionCtx.clearRect(0, 0, canvas.width, canvas.height);

  // console.log('delta time', deltaTimeInSeconds);

  switch (gameStatus) {
    case 'gameStart':
      // game is running
      if (landscapeObjectArray.length === 0) {
        landscapeObjectArray.push(new Landscape());
        landscapeWaterObjectArray.push(new LandscapeWater());
        balloonObjectArray.push(new Balloon());
        collisionDetectionObjectArray.push(new CollisionDetection());
        scoreObjectArray.push(new Score());
      }

      // Create a math challenge object
      if (mathChallengeObjectArray.length === 0) {
        mathChallengeObjectArray.push(new MathChallenge());
      }

      // This variable allows us to position game elements on the moving landscape.
      // Occasionally, because of 'rounding', an item might not be placed and this
      // give a nice variance to objects that appear in the game
      let landscapeOffsetX = Math.round(Math.abs(landscapeObjectArray[0].sX));
      // console.log(landscapeOffsetX);
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 1550, windTurbinePlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 2101, windTurbinePlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 2951, windTurbinePlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 3601, windTurbinePlacement)
      ) {
        windTurbineObjectArray.push(new WindTurbine());
      }
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 101, cannonPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 3701, cannonPlacement)
      ) {
        cannonObjectArray.push(new Cannon('right'));
      }
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 1550, cannonPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 5600, cannonPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 5900, cannonPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 15900, cannonPlacement)
      ) {
        cannonObjectArray.push(new Cannon('left'));
      }
      //////////////////////////////////////////////////
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 901, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 5601, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 5701, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 5901, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9201, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9601, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9801, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 10201, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 10801, sharkFinPlacement)
      ) {
        sharkFinObjectArray.push(new SharkFin('left'));
      }
      // create the sharks fins swimming to the right
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 401, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 4001, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 4301, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 4801, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 8201, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 8701, sharkFinPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9301, sharkFinPlacement)
      ) {
        sharkFinObjectArray.push(new SharkFin('right'));
      }
      // shark head placement (with laser eyes)
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 8401, sharkHeadPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 8701, sharkHeadPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9101, sharkHeadPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 9901, sharkHeadPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 10301, sharkHeadPlacement)
      ) {
        sharkHeadObjectArray.push(new SharkHead());
      }
      // ice ghost placement
      if (
        objectPlacementOnXAxis(landscapeOffsetX, 6701, iceGhostPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 7301, iceGhostPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 7601, iceGhostPlacement) ||
        objectPlacementOnXAxis(landscapeOffsetX, 7901, iceGhostPlacement)
      ) {
        iceGhostObjectArray.push(new IceGhost());
      }
      // easter island placement
      if (
        objectPlacementOnXAxis(
          landscapeOffsetX,
          11601,
          easterIslandPlacement
        ) ||
        objectPlacementOnXAxis(
          landscapeOffsetX,
          12801,
          easterIslandPlacement
        ) ||
        objectPlacementOnXAxis(
          landscapeOffsetX,
          13401,
          easterIslandPlacement
        ) ||
        objectPlacementOnXAxis(landscapeOffsetX, 13901, easterIslandPlacement)
      ) {
        easterIslandObjectArray.push(new EasterIsland());
      }

      ///////////////////////////////////////////////////////
      ///////////////////////////////////////////////////////
      // console.log(landscapeObjectArray);
      // firing the update method in each object
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...balloonExplosionObjectArray,
        ...goldenCoinObjectArray,
      ].forEach(object => object.update(deltaTimeInSeconds));

      // firing the draw mathod in each object
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...balloonExplosionObjectArray,
        ...goldenCoinObjectArray,
        ...mathChallengeObjectArray,
        ...scoreObjectArray,
      ].forEach(object => object.draw(deltaTimeInSeconds));

      ////////////////////////////////
      // draw the math challenge score
      // if a coin has been hit, we want to move this coin to the answer area text,
      // and fade out all the other ones
      [...goldenCoinObjectArray].forEach(function (object) {
        // if this coin has been hit
        if (object.thisCoinHasBeenHit) {
          object.moveCoinToAnswerArea(deltaTimeInSeconds);
        }
      });

      [...goldenCoinObjectArray].forEach(function (object) {
        // if this coin has been hit
        if (object.fadeOutThisCoin) {
          object.fadeOut(deltaTimeInSeconds);
        }
      });

      ///////////////////////
      // collision detection
      // we need if clause because when the balloon
      // explosed, there is no balloon therefore
      // no collision detection is needed
      if (balloonObjectArray.length !== 0) {
        collisionDetectionObjectArray[0].updateLandScapeCollisionArray(
          deltaTimeInSeconds
        );
        collisionDetectionObjectArray[0].draw(deltaTimeInSeconds);
        collisionDetectionObjectArray[0].detectCollisions();
      }
      /////////////////////////
      // controlling the balloon

      if (spaceBarState === true && balloonObjectArray.length !== 0) {
        balloonObjectArray[0].balloonAddGas(deltaTimeInSeconds);
      }

      if (balloonObjectArray.length !== 0) {
        balloonObjectArray[0].moveOnXAxis(deltaTimeInSeconds);
        balloonObjectArray[0].balloonMovementPhysics();
        balloonObjectArray[0].draw();
      }

      /////////////////////////
      // firing the cannon animation
      // should I fire the cannon?
      cannonObjectArray.forEach(object =>
        object.fireTheCannon(deltaTimeInSeconds)
      );
      // the firingCannonAnimation runs if the above gives TRUE
      cannonObjectArray.forEach(object =>
        object.firingCannonAnimation(deltaTimeInSeconds)
      );

      ////////////////////////////////////
      // Create clouds
      timeToNextCloud += deltaTimeInSeconds;
      if (timeToNextCloud > cloudInterval) {
        cloudObjectArray.push(new Cloud());
        timeToNextCloud = 0;
        // sort the clouds in ascending order based speed
        // - so the fastest moving clouds are on top
        cloudObjectArray.sort(function (a, b) {
          return a.dX - b.dX;
        });
      }

      /////////////////////////////////////
      // Golden Coin Management
      // golden coins
      // At any one time, I want 3 coins on the screen.
      // One of those coins needs to be the current answer to the
      // maths problem shown, all three coinds must not have duplicates.
      // if no coin has been hit by the balloon
      if (
        // no coin has been hit by the balloon
        goldenCoinObjectArray.find(e => e.thisCoinHasBeenHit === true) ===
          undefined &&
        mathChallengeObjectArray.length !== 0
      ) {
        let currentCorrectAnswer = mathChallengeObjectArray[0].mathAnswer;

        let goldenCoinsOnScreen = goldenCoinObjectArray.length;
        // if there's less than 3 coins on the screen
        if (goldenCoinsOnScreen < 3) {
          // console.log('current answer ', currentCorrectAnswer);
          // does one of the coins have the maths solutions?
          let foundAnswer = goldenCoinObjectArray.find(
            e => e.randomNumber === currentCorrectAnswer
          );
          // if one odf the coins does NOT have the answer on it
          if (foundAnswer === undefined) {
            goldenCoinObjectArray.push(new GoldenCoin(currentCorrectAnswer));
          } else {
            // one of the coins does have the answer on it so
            // create a coin that has any number on it OTHER than
            // the answer
            let notUnique = false;
            while (!notUnique) {
              let randomNumber = Math.round(getRandomArbitrary(1, 10));
              let foundAnswer = goldenCoinObjectArray.find(
                e => e.randomNumber === randomNumber
              );
              if (foundAnswer === undefined) {
                goldenCoinObjectArray.push(new GoldenCoin(randomNumber));
                break;
              }
            }
          }
        }
      }

      // when the balloon gets across the landscape, trigger the
      // 'youWin' section of the game because the player has survived
      // console.log(landscapeOffsetX);
      //console.log(balloonObjectArray[0].dX);
      // console.log(landscapeOffsetX);
      if (landscapeOffsetX > 16700) gameStatus = 'youWin';
      break;

    case 'youWin':
      // here we want the landscape to stop and the balloon to move to the right
      // and go off the screen
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...goldenCoinObjectArray,
      ].forEach(object => object.update(deltaTimeInSeconds));

      [
        ...balloonObjectArray,
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...mathChallengeObjectArray,
        ...scoreObjectArray,
      ].forEach(object => object.draw(deltaTimeInSeconds));

      balloonObjectArray[0].accelarateRightOffScreen(deltaTimeInSeconds);

      // when the win fanfare has played, fade out the scenary and show
      // the 'You win' object with the final score
      timeAfterFanfareTimer += deltaTimeInSeconds;
      if (timeAfterFanfareTimer > timeAfterFanFare) {
        // delete the math and score objects
        [...mathChallengeObjectArray].forEach(
          object => (object.markedForDeletion = true)
        );
        [...scoreObjectArray].forEach(
          object => (object.markedForDeletion = true)
        );
        // mathChallengeObjectArray[0].markedForDeletion = true;
        // scoreObjectArray[0].markedForDeletion = true;

        if (youWinObjectArray.length === 0) {
          youWinObjectArray.push(new YouWin());
        }
        youWinObjectArray[0].update(deltaTimeInSeconds);
        youWinObjectArray[0].draw(deltaTimeInSeconds);
      }
      // we need to adjust the master game speed of all object incrementally
      // smaller so that the landscape slows down to a stop
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...balloonExplosionObjectArray,
        ...goldenCoinObjectArray,
      ].forEach(function (object) {
        // object.speed >= 0 ? (object.speed -= 0.1) : (object.speed = 0);
        object.speed = 0;
        console.log(object.speed);
      });

      // end the game loop if the 'Game Over' text has appeared and it's
      // at it's maximum text size... this is when the gameloop can effectively
      // end and nothing is moving on the screen.
      if (youWinObjectArray.length !== 0) {
        if (
          youWinObjectArray[0].fontSize === youWinObjectArray[0].maxfontSize
        ) {
          console.log(youWinObjectArray[0].fontSize);
          gameStatus = false;
          // we need to stop the theme tune and put the volume back to 1 so that
          // it plays when the game restarts
          soundsArray.find(e => e.name === 'lifeIsBeautifulSound').sound.stop();
          soundsArray
            .find(e => e.name === 'lifeIsBeautifulSound')
            .sound.volume(1);
        }
      }

      break;

    case 'gameOverExplosion':
      // This partfade of the game loop triggers when
      // a collision is detected within the CollisionDetection object
      console.log('Balloon crash game over');
      // Display all the scene as it currently is with not update of movements
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...balloonExplosionObjectArray,
        ...goldenCoinObjectArray,
        ...mathChallengeObjectArray,
        ...scoreObjectArray,
      ].forEach(object => object.draw(deltaTimeInSeconds));

      // create one explosion object at the current location
      // of the balloon
      if (balloonExplosionObjectArray.length === 0) {
        balloonExplosionObjectArray.push(
          new BalloonExplosion(
            balloonObjectArray[0].dX - 300,
            balloonObjectArray[0].dY - 200
          )
        );
      }

      balloonExplosionObjectArray[0].update(deltaTimeInSeconds);
      balloonExplosionObjectArray[0].draw(deltaTimeInSeconds);

      // fade out screen

      timeAfterExplosionBeforeDisplayingGameOverTimer += deltaTimeInSeconds;
      if (
        timeAfterExplosionBeforeDisplayingGameOverTimer >
        timeAfterExplosionBeforeDisplayingGameOver
      )
        gameStatus = 'displayGameOverText';

      break;

    case 'displayGameOverText':
      [
        ...cloudObjectArray,
        ...windTurbineObjectArray,
        ...landscapeWaterObjectArray,
        ...sharkFinObjectArray,
        ...sharkHeadObjectArray,
        ...sharkLaserObjectArray,
        ...landscapeObjectArray,
        ...cannonObjectArray,
        ...cannonBallObjectArray,
        ...iceGhostObjectArray,
        ...easterIslandObjectArray,
        ...easterIslandBallObjectArray,
        ...balloonExplosionObjectArray,
        ...goldenCoinObjectArray,
        //  ...mathChallengeObjectArray,
        //  ...scoreObjectArray,
      ].forEach(object => object.draw(deltaTimeInSeconds));

      balloonExplosionObjectArray[0].update(deltaTimeInSeconds);

      if (gameOverObjectArray.length === 0) {
        gameOverObjectArray.push(new GameOver());
      }
      // finish the explosion animation
      gameOverObjectArray[0].update(deltaTimeInSeconds);
      gameOverObjectArray[0].draw();
      // set the math challenge to be marked for deletion
      //mathChallengeObjectArray[0].markedForDeletion = true;

      // end the game loop if the 'Game Over' text has appeared and it's
      // at it's maximum text size... this is when the gameloop can effectively
      // end and nothing is moving on the screen.
      if (
        gameOverObjectArray[0].fontSize === gameOverObjectArray[0].maxfontSize
      ) {
        // the game theme tune has completed fading at this point, so we now
        // stop this play and then put the volume back to 'full volume' (1).
        // If this isn't done, the theme tune won't replay properly whne the
        // game re-starts
        soundsArray.find(e => e.name === 'lifeIsBeautifulSound').sound.stop();
        soundsArray
          .find(e => e.name === 'lifeIsBeautifulSound')
          .sound.volume(1);

        gameStatus = false;
      }

      break;
  }

  //////////////////////////////////
  // deletion of objects that are markedForDeletion
  function filterObjects(obj) {
    let index = obj.length;
    for (let i = index - 1; i >= 0; i--) {
      if (obj[i].markedForDeletion) obj.splice(i, 1);
    }
  }

  [
    cannonObjectArray,
    cannonBallObjectArray,
    windTurbineObjectArray,
    sharkFinObjectArray,
    cloudObjectArray,
    sharkHeadObjectArray,
    sharkLaserObjectArray,
    iceGhostObjectArray,
    easterIslandObjectArray,
    easterIslandBallObjectArray,
    goldenCoinObjectArray,
    mathChallengeObjectArray,
    scoreObjectArray,
    youWinObjectArray,
  ].forEach(x => {
    filterObjects(x);
  });

  if (gameStatus !== false) requestAnimationFrame(animate);

  // console.log(landscapeObjectArray);
  // console.log(balloonObjectArray);
  // console.log(balloonExplosionObjectArray);
  // console.log(landscapeWaterObjectArray);
  // console.log(cloudObjectArray);
  // console.log(cannonObjectArray);
  // console.log(cannonBallObjectArray);
  // console.log(windTurbineObjectArray);
  // console.log(sharkFinObjectArray);
  // console.log(sharkHeadObjectArray);
  // console.log(sharkLaserObjectArray);
  // console.log(iceGhostObjectArray);
  // console.log(easterIslandObjectArray);
  // console.log(easterIslandBallObjectArray);
  // console.log(collisionDetectionObjectArray);
  // console.log(goldenCoinObjectArray);
  // console.log(mathChallengeObjectArray);
  // console.log(scoreObjectArray);
  // console.log(gameOverObjectArray);
}

//////////////////////////////////////////////
// Event listeners ///////////////////////////
//press S to start the game
// document.addEventListener('keydown', function (e) {
//   console.log(e.code);
//   if (e.code === 'KeyS') {
//     preLoadAssets();
//   } else {
//     console.log('Press S key to preload assets');
//   }
// });

// when the game is over and 'Game Over' text appears
// we need to clear all the arrays so that the game
// fresh with all arrays emptied
function resetGame() {
  // clear the array of objects

  [
    landscapeObjectArray,
    balloonObjectArray,
    balloonExplosionObjectArray,
    landscapeWaterObjectArray,
    cloudObjectArray,
    cannonObjectArray,
    cannonBallObjectArray,
    windTurbineObjectArray,
    sharkFinObjectArray,
    sharkHeadObjectArray,
    sharkLaserObjectArray,
    iceGhostObjectArray,
    easterIslandObjectArray,
    easterIslandBallObjectArray,
    collisionDetectionObjectArray,
    goldenCoinObjectArray,
    mathChallengeObjectArray,
    scoreObjectArray,
    gameOverObjectArray,
    youWinObjectArray,
    //].forEach(element => (element = []));
  ].forEach(element => element.splice(0, element.length));

  // clear the arrays holding the last position that objects were placed
  [
    windTurbinePlacement,
    cannonPlacement,
    sharkFinPlacement,
    sharkHeadPlacement,
    iceGhostPlacement,
    easterIslandPlacement,
  ].forEach(element => (element.x = 0));

  oldTimeStamp = 0;
  spaceBarState = false;
  arrowLeftState = false;
  arrowRightState = false;
  timeAfterExplosionBeforeDisplayingGameOverTimer = 0;
  timeToNextCloud = 0;
  canvas.width = 1920;
  canvas.height = 1080;
  // stop the 'you win' fanfare. This will stop it playing if the
  // user presses the space bar (to start a new game) before it's finished playing
  soundsArray.find(e => e.name === 'handyIntroduction').sound.stop();
}

//press spaceBar to start the game
document.addEventListener('keydown', function (e) {
  // console.log(e.code);
  if (e.code === 'Space' && gameInitialised && !gameStatus) {
    gameStatus = 'gameStart';
    // console.log('gameStatusgameStatus--------------- ', gameStatus);
    // console.log('gameInitialised--------------- ', gameInitialised);
    resetGame();
    animate();
  } else {
    // console.log('Press enter to preload assets');
  }
  if (e.code === 'Space' && gameInitialised && gameStatus === 'gameStart') {
    spaceBarState = true;
  }
});

//press spaceBar to start the game
document.addEventListener('keyup', function (e) {
  if (e.code === 'Space' && gameInitialised && gameStatus === 'gameStart') {
    spaceBarState = false;
  }
});

// balloon left right controls
// balloon right
document.addEventListener('keydown', function (e) {
  if (e.code === 'ArrowRight') {
    arrowRightState = true;
  }
});
document.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowRight') {
    arrowRightState = false;
  }
});
// balloon left
document.addEventListener('keydown', function (e) {
  if (e.code === 'ArrowLeft') {
    arrowLeftState = true;
  }
});
document.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowLeft') {
    arrowLeftState = false;
  }
});

//test
/*
let a1 = [];
let a2 = [];

a1.push({ name: 'james', age: 25 });
a1.push({ name: 'jack', age: 23 });

a2.push({ name: 'gary', fruit: 'banana', myLetter: 'a' });
a2.push({ name: 'bernary', fruit: 'apple', myletter: 'b' });

console.log(a1, a2);
console.log('------');
[a1, a2].forEach(element => element.splice(0, element.length));

console.log(a1, a2);

let a3 = { x: 2 };
let a4 = { x: 4000 };
[a3, a4].forEach(element => (element.x = 0));

console.log(a3, a4);
*/
