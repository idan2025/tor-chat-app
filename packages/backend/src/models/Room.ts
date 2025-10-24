import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface RoomAttributes {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  encryptionKey: string;
  creatorId: string;
  maxMembers?: number;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCreationAttributes extends Optional<RoomAttributes, 'id'> {}

export class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  public id!: string;
  public name!: string;
  public description?: string;
  public type!: 'public' | 'private';
  public encryptionKey!: string;
  public creatorId!: string;
  public maxMembers?: number;
  public avatar?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Sanitize room data (remove encryption key from public view)
   */
  public toPublicJSON(): any {
    const values: any = { ...this.get() };
    delete values.encryptionKey;
    return values;
  }
}

Room.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'public',
      allowNull: false,
    },
    encryptionKey: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    maxMembers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 100,
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rooms',
    timestamps: true,
    indexes: [
      { fields: ['name'] },
      { fields: ['creatorId'] },
      { fields: ['type'] },
    ],
  }
);
