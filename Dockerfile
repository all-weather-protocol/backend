# Use the official Node.js image as a parent image
FROM node:16.20.2-buster

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies defined in package.json using Yarn
RUN yarn install

# Copy the rest of the application to the working directory
COPY . .

# Make port 3000 available outside the container
EXPOSE 3000

# Run the application
# Setup ENTRYPOINT
ENTRYPOINT ["./entrypoint.sh"]
CMD [ "yarn", "start" ]
