import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export type TrackSnapshot = {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artwork: string | null;
  duration: number;
  genre?: string | null;
  album?: string | null;
  albumId?: string | null;
};

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const playlists = pgTable(
  "playlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("playlists_user_idx").on(t.userId)],
);

export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    track: jsonb("track").$type<TrackSnapshot>().notNull(),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [index("playlist_tracks_playlist_idx").on(t.playlistId)],
);

export const likedSongs = pgTable(
  "liked_songs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    track: jsonb("track").$type<TrackSnapshot>().notNull(),
    likedAt: timestamp("liked_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("liked_songs_user_track_idx").on(t.userId, t.trackId)],
);
