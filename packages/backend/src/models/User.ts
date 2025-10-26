import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import bcrypt from 'bcrypt';
import { config } from '../config';

interface UserAttributes {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  publicKey: string;
  privateKeyEncrypted?: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  isAdmin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isOnline' | 'lastSeen'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare username: string;
  declare email?: string;
  declare passwordHash: string;
  declare publicKey: string;
  declare privateKeyEncrypted?: string;
  declare displayName?: string;
  declare avatar?: string;
  declare isOnline: boolean;
  declare lastSeen: Date;
  declare isAdmin: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /**
   * Compare password with hash
   */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  /**
   * Hash password before saving
   */
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcrypt.rounds);
  }

  /**
   * Sanitize user data for public view (remove sensitive fields)
   */
  public toJSON(): any {
    const values: any = { ...this.get() };
    delete values.passwordHash;
    delete values.privateKeyEncrypted;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isAlphanumeric: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    privateKeyEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lastSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['username'] },
      { fields: ['email'] },
      { fields: ['isAdmin'] },
    ],
  }
);
