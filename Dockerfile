# Use a lightweight Node.js image
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Expose the port your app runs on
EXPOSE 3000

# Command to run your app
CMD ["node", "dist/server.js"]