const Discord = require("discord.js");
const images = require("../images");
const Canvas = require("canvas");
const stream = require("stream");
const fs = require("fs");
const path = require("path");
const request = require("request");
const { getHeroName, log } = require("../utils");

const sendImage = function(image, message, isUpdated) {
  const messageWithNote = "Note: This image needs to be updated";
  return isUpdated === false
    ? message.channel
        .send(messageWithNote, image)
        .then(() => log("Successfully sent image"))
        .catch(error => console.error(error))
    : message.channel
        .send(image)
        .then(() => log("Successfully sent image"))
        .catch(error => console.error(error));
};

async function fetchImage(imgType, hero, savePath) {
  const filePath = `${savePath}.${imgType}`;
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        const req = request.get({
          uri: `${process.env.AWSHEROESURL}/${hero}.${imgType}`,
          headers: {
            "Content-Type": "image/png"
          }
        });
        const stream = fs.createWriteStream(filePath);
        req.pipe(stream);
        stream.on("finish", () => {
          resolve(filePath);
        });
        stream.on("error"),
          () => {
            reject("An error occurred while retrieving the image");
          };
      } else {
        console.log("Cached image found");
        resolve(filePath);
      }
    });
  });
}

async function getAwsImage(hero, savePath) {
  return new Promise((resolve, reject) => {
    fetchImage("png", hero, savePath)
      .then(filePath => {
        console.log("png found..", filePath);
        resolve(filePath);
      })
      .catch(() => {
        console.log("PNG not found.");
        fetchImage("jpg", hero, savePath)
          .then(filePath => {
            console.log("jpg found.");
            resolve(filePath);
          })
          .catch(err => {
            console.log("JPG not found");
            reject("Hero image not found");
          });
      });
  });
}

const getImage = async (hero, message) => {
  try {
    const canvas = Canvas.createCanvas(460, 680);
    const ctx = canvas.getContext("2d");
    const sendToDiscord = inAws => {
      const image = new Discord.Attachment(canvas.toBuffer(), `${hero}.png`);
      sendImage(image, message, inAws);
    };

    const awsName = hero.replace(/\s/g, ""); // Remove white space for AWS
    const savePath = path.join(__dirname + "/../temp/", hero);
    getAwsImage(awsName, savePath)
      .then(filePath => {
        const img = new Canvas.Image();
        img.onload = () => ctx.drawImage(img, 0, 0, 460, 680);
        img.onerror = err => {
          throw err;
        };
        img.src = fs.createReadStream(filePath).read();
        sendToDiscord(true);
      })
      .catch(err => {
        message.channel.send(err);
      });
  } catch (error) {
    console.error(error);
    message.reply("Uh oh. Something went wrong. Please try again.");
  }
};

module.exports = {
  name: "image",
  description: "Get image for hero",
  args: true,
  execute: async function(message, args) {
    if (args.length) {
      try {
        const hero = getHeroName(args);
        return getImage(hero, message);
      } catch (error) {
        console.error(error);
        message.reply("Uh oh. Something went wrong. Please try again.");
      }
    }
  }
};
