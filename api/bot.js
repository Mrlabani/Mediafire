const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Send me a Mediafire link and I will download the file for you.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && text.includes('mediafire.com')) {
    bot.sendMessage(chatId, 'Processing your Mediafire link...');
    try {
      const fileId = extractMediafireFileId(text);
      if (fileId) {
        const downloadUrl = `https://www.mediafire.com/file/${fileId}/file`;
        const response = await axios({
          url: downloadUrl,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        const filePath = path.join('/tmp', 'downloaded_file');
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.data.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = ((downloadedSize / totalSize) * 100).toFixed(2);
          bot.sendChatAction(chatId, 'upload_document');
          bot.sendMessage(chatId, `Download Progress: ${progress}%`, { disable_notification: true });
        });

        response.data.pipe(fs.createWriteStream(filePath));

        response.data.on('end', () => {
          bot.sendDocument(chatId, filePath).then(() => {
            fs.unlink(filePath, (err) => {
              if (err) console.error('Error deleting the file:', err);
            });
          }).catch((sendError) => {
            bot.sendMessage(chatId, 'Failed to send the file.');
            console.error('Error sending the file:', sendError);
          });
        }).on('error', (streamError) => {
          bot.sendMessage(chatId, 'Error downloading the file.');
          console.error('Error downloading the file:', streamError);
        });
      } else {
        bot.sendMessage(chatId, 'Unable to extract file ID from the Mediafire link.');
      }
    } catch (error) {
      bot.sendMessage(chatId, 'Failed to process the Mediafire link.');
      console.error('Error processing the link:', error);
    }
  }
});

function extractMediafireFileId(url) {
  try {
    const urlObj = new URL(url);
    const regex = /mediafire\.com\/file\/(\w+)\//;
    const match = regex.exec(urlObj.pathname);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Invalid URL:', error);
    return null;
  }
}

module.exports = async (req, res) => {
  res.status(200).send('Bot is running');
};
                           
