import { User } from './User';
import { Room } from './Room';
import { Message } from './Message';
import { RoomMember } from './RoomMember';

// Define associations
User.hasMany(Room, { foreignKey: 'creatorId', as: 'createdRooms' });
Room.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

Room.hasMany(Message, { foreignKey: 'roomId', as: 'messages' });
Message.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

User.belongsToMany(Room, { through: RoomMember, foreignKey: 'userId', as: 'rooms' });
Room.belongsToMany(User, { through: RoomMember, foreignKey: 'roomId', as: 'members' });

RoomMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
RoomMember.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

export { User, Room, Message, RoomMember };
