# Backend

Use this backend service to get the hex data needed by frontend

## Install

`yarn`

## Endpoints

1. `pendle/zapIn`: <http://localhost:3002/pendle/zapIn?chainId=42161&poolAddress=0xa0192f6567f8f5DC38C53323235FD08b318D2dcA&amount=10&slippage=0.2&tokenInAddress=0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1>
1. `pendle/zapOut`: <http://localhost:3002/pendle/zapIn?chainId=42161&poolAddress=0xa0192f6567f8f5DC38C53323235FD08b318D2dcA&amount=10&slippage=0.2&tokenInAddress=0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1>

## Dev

`yarn dev`

## Start

`yarn start`

## Deploy

## Deploy

1. Set Up Authentication (only need to do it once): `gcloud auth configure-docker --project allweatherportfolioprotocol; gcloud auth login --project allweatherportfolioprotocol`
2. Build, Tag and Push Docker image to Google Container Register (GCR): `TAG=x.xx; docker build --platform linux/amd64 -t allweather-protocol-backend:$TAG .; docker tag allweather-protocol-backend:$TAG gcr.io/allweatherportfolioprotocol/allweather-protocol-backend:$TAG; docker push gcr.io/allweatherportfolioprotocol/allweather-protocol-backend:$TAG`
3. update tag version in Cloud run (portfolio-backend):
    ![docs](docs/cloudrun.png)