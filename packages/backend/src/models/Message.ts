import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface MessageAttributes {
  id: string;
  roomId: string;
  senderId: string;
  encryptedContent: string;
  messageType: 'text' | 'file' | 'image' | 'video' | 'system';
  metadata?: object;
  attachments?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface MessageCreationAttributes extends Optional<MessageAttributes, 'id'> {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: string;
  declare roomId: string;
  declare senderId: string;
  declare encryptedContent: string;
  declare messageType: 'text' | 'file' | 'image' | 'video' | 'system';
  declare metadata?: object;
  declare attachments?: string[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Message.init(
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
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    encryptedContent: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    messageType: {
      type: DataTypes.ENUM('text', 'file', 'image', 'video', 'system'),
      defaultValue: 'text',
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    timestamps: true,
    indexes: [
      { fields: ['roomId'] },
      { fields: ['senderId'] },
      { fields: ['createdAt'] },
    ],
  }
);
