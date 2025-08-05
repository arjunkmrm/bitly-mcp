# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY index.ts ./
COPY mock-bitly-sdk.ts ./

# Build TypeScript
RUN npm run build

# Expose port 8000
EXPOSE 8000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bitly -u 1001
USER bitly

# Start the application
CMD ["node", "dist/index.js"]