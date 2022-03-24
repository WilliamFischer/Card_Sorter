import { Component } from '@angular/core';
import { BluetoothSerial } from '@awesome-cordova-plugins/bluetooth-serial/ngx';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';
// import {
//   CameraPreview,
//   CameraPreviewOptions,
//   CameraPreviewPictureOptions,
// } from '@capacitor-community/camera-preview';
import {
  CameraPreview,
  CameraPreviewPictureOptions,
  CameraPreviewOptions,
} from '@awesome-cordova-plugins/camera-preview/ngx';
import {
  HttpClient,
  HttpHeaders,
  HttpHeaderResponse,
} from '@angular/common/http';
import { LoadingController, Platform } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  isConnected: boolean;
  failedConnection: boolean;
  processingPhoto: boolean;
  flashMode: boolean;

  isInFoilMode: boolean = false;
  isInFirstEditionMode: boolean = false;

  imageUrl: string;
  displayPhoto: string;
  series: string = '';

  apiKey: string = 'AIzaSyBtzx-mz8wr6fxLkaG_fCfQoZSWGqtj0vQ';
  tcgClientID: string = 'dd9f7b9c-6234-4b87-9604-6a0f71ddad6b';
  tcgClientSecret: string = '3e95a04f-f366-471d-acb0-fde492480867';

  fabCard: any;
  shoppingResults: any;

  constructor(
    private bluetoothSerial: BluetoothSerial,
    private http: HttpClient,
    private nativeHttp: HTTP,
    private platform: Platform,
    public loadingController: LoadingController,
    public cameraPreview: CameraPreview
  ) {
    document.body.style.backgroundColor = 'transparent !important';

    this.platform.ready().then(async () => {
      this.prepareCamera();
      this.connectBT();
      this.toggleFlashOff();
    });
  }

  prepareCamera() {
    let cameraPreviewOptions: CameraPreviewOptions = {
      camera: 'rear',
      toBack: true,
      x: 0,
      y: 0,
    };

    this.cameraPreview
      .stopCamera()
      .then(() => {
        this.startCamera(cameraPreviewOptions);
      })
      .catch(() => {
        this.startCamera(cameraPreviewOptions);
      });
  }

  startCamera(cameraPreviewOptions) {
    this.cameraPreview.startCamera(cameraPreviewOptions);
  }

  async connectBT() {
    const macAddress = '6AFB0CC6-E4A2-F7B1-FC0A-BA29026B5CDD';
    await this.bluetoothSerial.connect(macAddress).subscribe((connected) => {
      if (connected) {
        this.isConnected = true;
      } else {
        this.failedConnection = true;
      }
    });

    setTimeout(() => {
      this.LookForSorter();
    }, 3000);
  }

  // async getTCGPrices() {
  //   let data = ;
  //   this.nativeHttp.post(, data, 'application/x-www-form-urlencoded').then(response => {
  //     console.log(response.data);
  //   }).catch(error => {
  //     console.log(JSON.stringify(error));
  //   });
  // }

  async watchBluetooth() {
    this.bluetoothSerial.subscribeRawData().subscribe((data) => {
      var eightBit = new Uint8Array(data);
      var bytes = String.fromCharCode(Number(eightBit));

      if (bytes == 'P') {
        this.isInFoilMode = true;
        document.getElementById('nonFoilLabel').style.display = 'none';
        document.getElementById('foilLabel').style.display = 'inline';
      } else if (bytes == 'F') {
        this.isInFoilMode = false;
        document.getElementById('nonFoilLabel').style.display = 'inline';
        document.getElementById('foilLabel').style.display = 'none';
      } else if (bytes == 'H') {
        this.isInFirstEditionMode = true;
        document.getElementById('unlimitedLabel').style.display = 'none';
        document.getElementById('firstEditionLabel').style.display = 'inline';
      } else if (bytes == 'G') {
        this.isInFirstEditionMode = false;
        document.getElementById('firstEditionLabel').style.display = 'none';
        document.getElementById('unlimitedLabel').style.display = 'inline';
      }

      console.log(this.isInFoilMode, this.isInFirstEditionMode);
    });
  }

  LookForSorter() {
    this.bluetoothSerial.isConnected().then(
      () => {
        console.log('CONNECTION SUCCESS');
        this.isConnected = true;
        this.failedConnection = false;

        this.watchBluetooth().then(() => {
          this.bluetoothSerial.write('Z'); // Trigger bluetooth init to device
          this.bluetoothSerial.write('F');
        });
      },
      () => {
        console.log('CONNECTION FAILURE');
        this.connectBT();
      }
    );
  }

  async takePicture() {
    this.cameraPreview.setZoom(4);

    setTimeout(() => {
      this.displayPhoto = '';

      this.cameraPreview
        .takePicture()
        .then((base64PictureData) => {
          this.getLabels(String(base64PictureData[0]));
          this.displayPhoto = 'data:image/png;base64,' + base64PictureData[0];
        })
        .catch((error) => [console.log(error)]);
    }, 3000);
  }

  async tryName() {
    this.cameraPreview.setZoom(0);

    setTimeout(() => {
      this.displayPhoto = '';
      this.cameraPreview
        .takePicture()
        .then((base64PictureData) => {
          this.trySimilarImages(String(base64PictureData[0]));
          this.displayPhoto = 'data:image/png;base64,' + base64PictureData[0];
        })
        .catch((error) => [console.log(error)]);
    }, 3000);
  }

  async getLabels(base64Image) {
    this.series = '';
    this.fabCard = {};
    this.processingPhoto = true;

    const postData = {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    this.http
      .post(
        'https://vision.googleapis.com/v1/images:annotate?key=' + this.apiKey,
        postData,
        {}
      )
      .subscribe(
        async (data) => {
          // console.log(data);
          //console.log(data['responses'][0].textAnnotations);

          const allText = data['responses'][0].textAnnotations;
          await allText.forEach(async (text) => {
            if (
              text.description.includes('ELE') ||
              text.description.includes('ARC') ||
              text.description.includes('WTR') ||
              text.description.includes('CRU') ||
              text.description.includes('MON') ||
              text.description.includes('LGS')
            ) {
              if (
                text.description.length == 6 &&
                !text.description.includes(' ')
              ) {
                const cardLetters = text.description.toString().slice(0, 3),
                  cardDigits = text.description
                    .toString()
                    .slice(3, 6)
                    .replace('O', '0')
                    .replace('o', '0');

                const finalID = cardLetters + cardDigits;

                this.series = await finalID;
                this.getFabCard(this.series);
              }
            }
          });
        },
        (error) => {
          this.processingPhoto = false;
          this.isConnected = false;
          this.displayPhoto = '';
          alert(JSON.stringify(error));
        }
      );

    setTimeout(() => {
      if (this.series.length == 0) {
        this.processingPhoto = false;
        this.failedConnection = false;
        this.displayPhoto = '';
        console.log('Card could not be located :(');
      }
    }, 10000);
  }

  trySimilarImages(base64Image) {
    this.series = '';
    this.fabCard = {};
    this.processingPhoto = true;

    const postData = {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'WEB_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    this.http
      .post(
        'https://vision.googleapis.com/v1/images:annotate?key=' + this.apiKey,
        postData,
        {}
      )
      .subscribe(async (data) => {
        console.log(data);

        const pageTitle =
          data['responses'][0].webDetection.pagesWithMatchingImages[0]
            .pageTitle;

        if (pageTitle) {
          alert(pageTitle);
        }
      });

    setTimeout(() => {
      if (this.series.length == 0) {
        this.processingPhoto = false;
        this.failedConnection = false;
        this.displayPhoto = '';
        console.log('Card could not be located :(');
      }
    }, 15000);
  }

  getFabCard(seriesNum) {

    console.log(seriesNum);

    this.nativeHttp
      .get(encodeURI('https://api.fabdb.net/cards/' + seriesNum), {}, {})
      .then(async (data) => {
        this.fabCard = await JSON.parse(data.data);
        this.fabCard.isFoil = this.isInFoilMode;
        this.fabCard.isFirstEdition = this.isInFirstEditionMode;
        //this.getPrices(this.fabCard.name);
        //console.log(this.fabCard.identifier)
        console.log(data);

        this.manageTcgPriceGetter().then((token: string) => {
          console.log('Toke');
          console.log(token);
          this.authorizeAppWithTCGPlayer(token, this.fabCard.identifier).then(
            (cardData: any) => {
              console.log(cardData.results);
              if (cardData.results) {
                const productID = cardData.results[0].productId;
                this.getTCGPrices(token, productID).then(() =>
                  this.finishedAll()
                );
              } else {
                alert('Failed getting FAB Card');
                this.processingPhoto = false;
                this.failedConnection = false;
                this.displayPhoto = '';
              }
            }
          );
        });
      })
      .catch((error) => {
        console.log(error);
        alert('Failed getting FAB Card 2');
        this.processingPhoto = false;
        this.failedConnection = false;
        this.displayPhoto = '';
      });
  }

  async getTCGPrices(token, productID) {
    console.log('## GET TCG PRICES ##');

    const headers = {
      Accept: 'application/json',
      Authorization: 'bearer ' + token,
    };

    this.nativeHttp
      .get(
        'https://api.tcgplayer.com/pricing/product/' + productID,
        {},
        headers
      )
      .then(async (res) => {
        let allPrices = JSON.parse(res.data).results;

        await allPrices.forEach((price) => {
          if (!this.isInFoilMode && !this.isInFirstEditionMode) {
            if (price['subTypeName'] == 'Unlimited Edition Normal') {
              this.setFabObjectPrices(price);
            }
          }
          if (this.isInFoilMode && !this.isInFirstEditionMode) {
            if (price['subTypeName'] == 'Unlimited Edition Rainbow Foil') {
              this.setFabObjectPrices(price);
            }
          }
          if (!this.isInFoilMode && this.isInFirstEditionMode) {
            if (price['subTypeName'] == '1st Edition Normal') {
              this.setFabObjectPrices(price);
            }
          }
          if (this.isInFoilMode && this.isInFirstEditionMode) {
            if (price['subTypeName'] == '1st Edition Rainbow Foil') {
              this.setFabObjectPrices(price);
            }
          }
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }

  async manageTcgPriceGetter() {
    return new Promise((resolve) => {
      let accessToken = localStorage.getItem('tcg_access_token');
      if (!accessToken) {
        this.authorizeTCGPlayer().then((output) => {
          let token = output.access_token;
          if (token) {
            localStorage.setItem('tcg_access_token', token);
            resolve(token);
          }
        });
      } else {
        resolve(accessToken);
      }
    });
  }

  async authorizeTCGPlayer(): Promise<any> {
    return new Promise((resolve) => {
      let data = {
          client_id: this.tcgClientID,
          client_secret: this.tcgClientSecret,
          grant_type: 'client_credentials',
        },
        headers = {
          Accept: 'application/x-www-form-urlencoded',
        };

      this.nativeHttp
        .post('https://api.tcgplayer.com/token', data, headers)
        .then((res) => {
          resolve(JSON.parse(res.data));
        })
        .catch((error) => {
          resolve(error);
        });
    });
  }

  async authorizeAppWithTCGPlayer(token: string, name: string) {
    return new Promise((resolve) => {
      let headers = {
        Accept: 'application/json',
        Authorization: 'bearer ' + token,
      };

      this.nativeHttp
        .get(
          'https://api.tcgplayer.com/catalog/products?categoryId=62&productTypes=Cards&limit=1&productName=' +
            name.replace(' ', '%20'),
          {},
          headers
        )
        .then((res) => {
          resolve(JSON.parse(res.data));
        })
        .catch((error) => {
          resolve(error);
        });
    });
  }

  async setFabObjectPrices(price) {
    this.fabCard.marketPrice = price['marketPrice'];
    this.fabCard.lowPrice = price['lowPrice'];
    this.fabCard.midPrice = price['midPrice'];
    this.fabCard.highPrice = price['highPrice'];
    this.fabCard.subTypeName = price['subTypeName'];
  }

  // getSerpaPrices(fabCard) {
  //   let fabFinalURL =
  //     'https://serpapi.com/search.json?q=Flesh%20And%20Blood%20' +
  //     fabCard.replace(' ', '%20') +
  //     (!this.isInFirstEditionMode ? 'unlimited%20' : 'first%20edition%20') +
  //     (!this.isInFoilMode ? 'normal' : 'foil') +
  //     '%20card&tbm=shop&num=1&api_key=7851d373976ad2a3aefa1e2da2f47798c7ca9a33a0c3442de7e23c4c5b3d62f2';
  //   console.log(fabFinalURL);
  //   this.nativeHttp
  //     .get(encodeURI(fabFinalURL), {}, {})
  //     .then(async (data) => {
  //       let innerData = await JSON.parse(data.data);

  //       if (innerData['shopping_results'][0]) {
  //         this.fabCard.price =
  //           innerData['shopping_results'][0].price +
  //           ' (' +
  //           innerData['shopping_results'][0].delivery +
  //           ')';
  //         this.fabCard.price_title = innerData['shopping_results'][0].title;
  //         this.fabCard.price_link = innerData['shopping_results'][0].link;
  //         this.fabCard.price_source = innerData['shopping_results'][0].source
  //           .replace(/{(.*?)}/, '')
  //           .replace('.aULzUe', '');

  //         this.finishedAll();
  //       } else {
  //         alert('No prices found :( ');
  //         this.processingPhoto = false;
  //         this.failedConnection = false;
  //         this.displayPhoto = '';
  //       }
  //     })
  //     .catch((error) => {
  //       alert('Failed getting prices');
  //       console.log(error);
  //       this.processingPhoto = false;
  //       this.failedConnection = false;
  //       this.displayPhoto = '';
  //     });
  // }

  toggleFlashOn() {
    this.cameraPreview.setFlashMode('torch');
    this.flashMode = true;
  }

  toggleFlashOff() {
    this.cameraPreview.setFlashMode('off');
    this.flashMode = false;
  }

  finishedAll() {
    console.log(this.fabCard);

    // NEXT CARD NOW
    // Write a string
    this.processingPhoto = false;
    this.isConnected = true;
    this.failedConnection = false;
    this.displayPhoto = '';
    this.bluetoothSerial.write('N');
    this.bluetoothSerial.write('F');
    this.bluetoothSerial.write('N');
    this.bluetoothSerial.write('F');
  }
}
