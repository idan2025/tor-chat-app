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
  parentMessageId?: string; // For threaded replies
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
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
  declare parentMessageId?: string;
  declare isEdited?: boolean;
  declare editedAt?: Date;
  declare isDeleted?: boolean;
  declare deletedAt?: Date;

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
    parentMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id',
      },
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
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
      { fields: ['parentMessageId'] },
      { fields: ['isDeleted'] },
    ],
  }
);
