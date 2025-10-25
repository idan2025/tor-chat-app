import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface RoomMemberAttributes {
  id: string;
  roomId: string;
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomMemberCreationAttributes extends Optional<RoomMemberAttributes, 'id' | 'joinedAt'> {}

export class RoomMember extends Model<RoomMemberAttributes, RoomMemberCreationAttributes> implements RoomMemberAttributes {
  declare id: string;
  declare roomId: string;
  declare userId: string;
  declare role: 'admin' | 'moderator' | 'member';
  declare joinedAt: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RoomMember.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'rooms',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('admin', 'moderator', 'member'),
      defaultValue: 'member',
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'room_members',
    timestamps: true,
    indexes: [
      { fields: ['roomId'] },
      { fields: ['userId'] },
      { unique: true, fields: ['roomId', 'userId'] },
    ],
  }
);
