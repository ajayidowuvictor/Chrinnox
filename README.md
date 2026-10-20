# Chrinnox

A social app where people can post, like, comment, follow each other and get notifications.

Built by **JustNew**.

## Features

- Sign up, log in and log out
- Create posts with text and images
- Like, comment on and delete (your own) posts
- Follow and unfollow people, with suggested users
- Profile pages with editable name, bio, link, profile photo and cover photo
- Notifications for follows, likes and comments

## Tech

React, Tailwind + daisyUI, Node.js, Express, MongoDB, Cloudinary (images), JWT login.

## Settings (.env file)

Copy `.env-sample` to `.env` and fill it in:

```
MONGO_URI=      your MongoDB Atlas connection string
PORT=5000
JWT_SECRET=     any long random text
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Run on your computer

```
npm install
npm install --prefix frontend
npm run dev                      (backend, port 5000)
npm run dev --prefix frontend    (frontend, port 3000)
```

## Build and start for the live site

```
npm run build
npm start        (set NODE_ENV=production)
```

## Licence

MIT. Based on an MIT-licensed project by Burak; the original notice is kept in `LICENSE`.
