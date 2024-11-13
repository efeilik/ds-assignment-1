# Serverless API for Player Stats with Translation

## Overview

This project demonstrates a REST API built using AWS services, leveraging AWS Lambda, API Gateway, DynamoDB, Amazon Translate, and Cognito. The API is designed to manage player stats, allowing users to perform various CRUD operations on the stats and interact with the translation service.

The API allows authenticated users to:
- Add player stats.
- Update player stats.
- Retrieve player stats based on the partition key (`playerId`) and filter with query strings.
- Get translated text attributes of player stats into a specified language using Amazon Translate.

## Architecture

The project utilizes the following AWS services:
- **AWS Lambda**: For serverless computing to handle HTTP requests and business logic.
- **Amazon API Gateway**: For managing the HTTP endpoints and routing requests to Lambda functions.
- **DynamoDB**: For storing player stats and metadata, including user authentication details.
- **Amazon Translate**: For translating text attributes into a specified language.
- **Amazon Cognito**: For user authentication and authorization.

### CDK Stack

The AWS resources are provisioned using **AWS CDK**, including:
- **Lambda Functions**: For handling API requests and business logic.
- **API Gateway**: For managing HTTP endpoints.
- **DynamoDB Tables**: For storing player stats and translations.
- **Cognito User Pool**: For user authentication.
- **IAM Roles and Policies**: To grant permissions to Lambda functions and other services like Amazon Translate.

## Table Structure

The DynamoDB table `PlayerStats` is designed with a **composite key**:
- **Partition Key**: `playerId` (Number)
- **Sort Key**: `seasonYear` (String)

The table contains the following attributes:
- `playerId` (Number)
- `seasonYear` (String)
- `team` (String)
- `position` (String)
- `goalsScored` (Number)
- `assists` (Number)
- `appearances` (Number)
- `description` (String)
- `userId` (String) – User who added the stats (for authorization purposes).

### Translation Feature
The table includes a field `description` that will be translated into the requested language using **Amazon Translate**. The translations will be persisted for future use in the `TranslatedStats` table.

## API Endpoints

### 1. `POST /stats`
Adds a new player stats item to the DynamoDB table. This operation is protected by authentication (only authenticated users can perform this operation).

### 2. `GET /stats`
Retrieves all player stats items. This is a public endpoint.

### 3. `GET /stats/{playerId}`
Retrieves a player stats item for a specific playerId. This is a public endpoint.

### 4. `PUT /stats/{playerId}/{seasonYear}`
Updates a player stats item. Only the user who created the item can update it. This is a protected operation requiring authentication.

### 5. `GET /stats/{playerId}/{seasonYear}/translation?language=fr`
Retrieves the player stats item with text attributes translated to a specified language. In this case, French (fr) using Amazon Translate.

## Authentication & Authorization
Authentication is handled using Amazon Cognito. Users must authenticate to perform POST and PUT operations.
Authorization ensures that only the user who added the player stats can update them. Only GET requests are public.

## AWS CDK Deployment
The project uses AWS CDK to provision the following resources:

Lambda Functions: For handling API requests.
API Gateway: For managing HTTP endpoints.
DynamoDB Tables: For storing player stats.
Cognito User Pool: For user authentication.
IAM Roles: To grant the necessary permissions to Lambda functions and other services.

## Deployment Steps
Clone the repository.

### Install AWS CDK and dependencies:
npm install -g aws-cdk
npm install

### Deploy the CDK stack:
cdk deploy

## GitHub Repository
The code for the project is available on GitHub: (https://github.com/efeilik/ds-assignment-1.git)

## YouTube Demo Video
A video demonstration of the API can be found here: (https://www.youtube.com/watch?v=FOAtmye1jhQ)