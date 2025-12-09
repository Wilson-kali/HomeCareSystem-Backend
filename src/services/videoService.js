const twilio = require('twilio');

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const generateVideoToken = (identity, roomName) => {
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET
  );

  token.identity = identity;
  const videoGrant = new VideoGrant({ room: roomName });
  token.addGrant(videoGrant);

  return token.toJwt();
};

const createRoom = async (roomName) => {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    const room = await client.video.rooms.create({
      uniqueName: roomName,
      type: 'group',
      recordParticipantsOnConnect: true
    });
    return room;
  } catch (error) {
    console.error('Room creation error:', error);
    throw error;
  }
};

module.exports = { generateVideoToken, createRoom };
