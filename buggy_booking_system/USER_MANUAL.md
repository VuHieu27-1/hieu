# User Manual - Buggy Booking System

Tai lieu nay giai thich chi tiet code hien tai trong folder `buggy_booking_system`, tap trung vao:

1. Luong hoat dong tong the cua web booking
2. Cac file chinh trong he thong
3. Cac ham chinh va bien quan trong
4. Cach frontend va backend noi voi nhau
5. Cach doi URL dispatch server de noi sang he thong thuc te
6. Cach debug khi he thong gap loi

## 1. Muc tieu cua project

Project nay dong vai tro la `booking web + gateway server`.

No khong phai la he thong dispatch cuoi cung. Nhiem vu cua no la:

1. Hien form de khach tao yeu cau dat xe.
2. Ho tro nguoi dung chon diem don bang GPS hoac nhap dia chi tay.
3. Chuyen du lieu booking thanh JSON dung format.
4. Gui request toi dispatch server.
5. Nhan ve `taskId` va trang thai `PENDING_BROADCAST`.
6. Chuyen sang trang status de poll xem da co tai xe nhan cuoc hay chua.

## 2. Cau truc file

```text
buggy_booking_system/
|-- config/
|   |-- app.config.example.json
|   |-- app.config.json
|   `-- index.js
|-- data/
|   |-- bookings.db
|   `-- logs/
|-- lib/
|   `-- logger.js
|-- public/
|   |-- css/
|   |   `-- style.css
|   |-- img/
|   |   `-- d-soft-logo.png
|   |-- js/
|   |   |-- booking.js
|   |   |-- status.js
|   |   `-- theme.js
|   |-- booking.html
|   |-- index.html
|   `-- status.html
|-- docker-compose.yml
|-- Dockerfile
|-- README.md
|-- USER_MANUAL.md
`-- server.js
```

Y nghia tung file chinh:

- `server.js`: backend chinh, phuc vu file web, validate booking, geocode proxy, luu local, goi dispatch API.
- `public/js/booking.js`: logic lon nhat o frontend booking, gom form, GPS, map, geocode, submit, history.
- `public/js/status.js`: trang theo doi task sau khi da dat xe.
- `public/js/theme.js`: bat tat theme sang/toi.
- `lib/logger.js`: he thong log file va log console.
- `data/bookings.db`: database SQLite chinh de luu lich su booking.
- `Dockerfile` va `docker-compose.yml`: dong goi va chay project bang Docker.

## 3. Luong hoat dong tong the

### 3.1 Luong dat xe

1. Nguoi dung mo `booking.html`.
2. `booking.js` khoi tao form, cache, map, lich su va validation.
3. Nguoi dung nhap:
   - ten
   - so dien thoai
   - pickup area
   - drop-off point
   - so khach
   - kieu dat `NOW` hoac `SCHEDULED`
4. Neu nguoi dung bam `Use GPS`:
   - trinh duyet xin quyen Geolocation
   - web theo doi vi tri bang `watchPosition`
   - du lieu GPS duoc loc nhieu lan de giam nhieu
   - map di chuyen marker theo vi tri da loc
   - he thong reverse geocode de dien pickup area
5. Neu nguoi dung khong dung GPS:
   - van co the nhap dia chi tay
   - web thu geocode dia chi de dua len map
   - neu geocode khong duoc, van co co che fallback de booking khong bi chan qua gay gat
6. Khi bam `Book Now`:
   - frontend validate form
   - build JSON request dung schema booking moi
   - gui `POST /api/bookings`
7. Backend:
   - validate payload
   - goi dispatch server qua `dispatch.baseUrl`
   - nhan ve `taskId`
   - luu booking local
   - tra ve response async
8. Frontend nhan response:
   - hien overlay dang gui
   - hien `taskId`
   - redirect sang `status.html?task_id=...`

### 3.2 Luong theo doi trang thai

1. `status.html` mo len.
2. `status.js` doc `task_id` tu URL.
3. Cac ham trong `status.js` goi `GET /api/bookings/:taskId` moi 5 giay.
4. Backend hoac lay trang thai moi tu dispatch server, hoac fallback local neu dispatch tam thoi loi.
5. Neu `status = PENDING_BROADCAST`:
   - giao dien hien dang tim tai xe
6. Neu `status = ACCEPTED`:
   - hien ten xe
   - ETA
   - ten tai xe

## 4. Backend chi tiet - `server.js`

`server.js` la trung tam cua backend. File nay co 6 nhom logic chinh:

1. Config va constant
2. Quan ly storage local
3. Tao va luu booking
4. Goi dispatch API
5. Goi geocode API
6. Dinh nghia route Express

### 4.1 Bien cau hinh quan trong

Nhung bien nay quyet dinh he thong chay nhu the nao:

- `DEFAULT_PORT`: cong mac dinh cua web booking, thuong la `3000`.
- `PUBLIC_DIR`: folder chua HTML/CSS/JS frontend.
- `DATA_DIR`: folder luu du lieu local.
- `LOG_DIR`: folder log.
- `DATABASE_FILE`: duong dan toi file SQLite luu booking.
- `PHONE_REGEX`: regex kiem tra so dien thoai Viet Nam.
- `appConfig.dispatch.rawBaseUrl`: URL dispatch doc truc tiep tu file config.
- `DISPATCH_API_URL`: URL dispatch sau khi duoc normalize cho moi truong chay.
- `REVERSE_GEOCODE_URL`: endpoint reverse geocode.
- `SEARCH_GEOCODE_URL`: endpoint search geocode.
- `LOCATION_HTTP_TIMEOUT_MS`: timeout cho geocode API. Neu config dat `null` thi backend se doi response khong gioi han o tang app.
- `DISPATCH_HTTP_TIMEOUT_MS`: timeout cho dispatch API. Neu config dat `null` thi backend se doi response khong gioi han o tang app.
- `MAX_PENDING_BOOKINGS`: gioi han so booking local giu trong bo nho.
- `IDEMPOTENCY_TTL_MS`: thoi gian giu ket qua cua request co cung idempotency key.
- `PENDING_BROADCAST_STATUS`: hang status ban dau sau khi gui booking.
- `PENDING_BROADCAST_MESSAGE`: thong diep tra ve cho UI khi dang doi tai xe.

### 4.2 Logger va muc dich logger

`const logger = createLogger(...)`

Logger duoc tao tu `lib/logger.js`. Muc dich:

- ghi log file vao `data/logs`
- in log ra console
- chuan hoa format log
- tach category nhu `SERVER`, `BOOKING`, `DISPATCH`, `HTTP`, `STORAGE`

Dieu nay rat quan trong khi debug vi booking web, geocode va dispatch la 3 luong rieng. Neu khong co logger ro rang, se rat kho biet loi nam o dau.

### 4.3 Cac ham storage chinh

#### `initializeDatabase`

Chuc nang:

- mo file SQLite
- tao bang `bookings`
- tao index cho `task_id`, `phone`, `created_at`

Y nghia:

- moi lan server khoi dong, backend can dam bao schema SQL da san sang.
- index giup lookup nhanh hon cho history, task status va booking detail.

#### `ensureStorage`

Chuc nang:

- tao `data/`
- tao `logs/`
- khoi tao SQLite
- tinh lai sequence ID booking tu database

Day la mot trong nhung ham khoi dong quan trong nhat. Neu ham nay khong chay tot, server se khong co du lieu local de luu lich su booking.

#### `insertBookingRecord`

Chuc nang:

- chen mot booking moi vao bang `bookings`

Y nghia:

- backend hien tai dung SQLite thay vi ghi ca mang vao file JSON.
- du lieu luu ben hon cho van hanh lau dai.
- lookup theo phone, taskId, createdAt nhanh hon va de mo rong hon.

### 4.4 Cac ham tao booking

#### `generateBookingId`

Chuc nang:

- tao ID noi bo cho booking

ID nay khac `taskId`. Can phan biet:

- `id`: ID local trong booking server
- `taskId`: ID task do dispatch server tra ve

#### `normalizeIsoDateTime`

Chuc nang:

- nhan vao chuoi date/time
- tra ve ISO string hop le hoac `null`

Ham nay giup du lieu `scheduledTime` luon o dinh dang backend de xu ly.

#### `createBookingRecord`

Day la ham chinh de tao object booking chuan trong he thong local.

No build ra cac field:

- `id`
- `taskId`
- `status`
- `statusMessage`
- `guestName`
- `phone`
- `passengerCount`
- `bookingType`
- `scheduledTime`
- `pickup`
- `dropoff`
- `assignedVehicle`
- `estimatedPickupSeconds`
- `driver`
- `startTime`
- `endTime`
- `pickupTime`
- `createdAt`
- `updatedAt`

Y nghia:

- frontend gui len la payload booking
- dispatch server tra ve la payload async
- `createBookingRecord` la noi hop nhat hai nhom du lieu thanh model noi bo cua booking web

#### `enqueueBookingTask`

Chuc nang:

- dua booking moi vao hang doi ghi storage
- gioi han so job dang cho bang `MAX_PENDING_BOOKINGS`
- dam bao khong co qua nhieu request ghi booking dong thoi

#### `createBookingSafely`

Chuc nang:

- tao booking record
- chen booking vao SQLite
- xu ly an toan de tranh lam hong storage

Ham nay quan trong vi no la diem ghi du lieu chinh sau khi dispatch server chap nhan task.

### 4.5 Idempotency

Idempotency dung de tranh truong hop nguoi dung bam `Book Now` nhieu lan, mang cham, hoac browser retry request.

#### `sanitizeIdempotencyKey`

- lam sach key tu request header

#### `cleanupExpiredIdempotencyKeys`

- xoa nhung key da het han

#### `getIdempotentBookingResponse`

- neu cung key da duoc xu ly gan day, tra lai ket qua cu

#### `storeIdempotentBookingResponse`

- luu Promise ket qua vao memory

Y nghia thuc te:

- khach bam 2 lan lien tiep
- backend khong tao 2 booking khac nhau
- van giu tra nghiem an toan va de kiem soat

### 4.6 Cac ham HTTP den dispatch va geocode

#### `postJson`

Ham HTTP POST tong quat.

No duoc dung de:

- gui booking toi dispatch server

No tu xu ly:

- chon `http` hay `https`
- set header JSON
- timeout
- bat loi network
- parse body tra ve
- log request/response

Day la ham tang duoi giup backend de sau nay co doi dispatch server thi chi can doi URL, khong can viet lai cach goi HTTP.

#### `getJson`

Ham GET tong quat.

No duoc dung de:

- lay trang thai booking tu dispatch server
- goi geocode search
- goi reverse geocode

#### `buildDispatchEndpoint`

Ham nay cuc ky quan trong cho tinh linh hoat.

Chuc nang:

- ghep `dispatch.baseUrl` voi path can goi
- bao toan ca truong hop base URL co subpath

Vi du:

- `dispatch.baseUrl=http://localhost:4001`
- path `api/bookings`
- ket qua: `http://localhost:4001/api/bookings`

Hoac:

- `dispatch.baseUrl=https://real-server.example.com/v1/`
- path `api/bookings`
- ket qua: `https://real-server.example.com/v1/api/bookings`

Nho co ham nay ma project de doi tu mock sang server that.

#### `normalizeDispatchAcceptedResponse`

Chuc nang:

- chuan hoa response tu dispatch server
- dam bao co:
  - `taskId`
  - `status`
  - `message`

Neu server ngoai tra ve field khac nhau mot chut, backend van co mot lop normalize o giua.

#### `createDispatchBooking`

Chuc nang:

- goi `POST /api/bookings` den dispatch server
- lay response async ve

Day la ham trung tam cua luong submit booking.

#### `fetchDispatchBookingStatus`

Chuc nang:

- goi `GET /api/bookings/:taskId` den dispatch server

Trang status phu thuoc truc tiep vao ham nay.

#### `mergeBookingWithDispatchState`

Chuc nang:

- tron du lieu local booking voi du lieu moi nhat tu dispatch

Vi sao can:

- local co thong tin pickup/dropoff/guestName
- dispatch co thong tin trang thai moi nhat nhu `assignedVehicle`, `driver`, `estimatedPickupSeconds`
- UI can ca hai

### 4.7 Cac ham geocode va dia chi

#### `normalizeNominatimReverseGeocode`

Chuc nang:

- bien du lieu reverse geocode raw thanh object de frontend de dung hon

Thuong se tra ve:

- `display_address`
- `full_address`
- `road_name`
- `street_number`
- `ward`
- `district`
- `city`
- `country`

#### `normalizeBookingPoint`

Chuc nang:

- chuan hoa object `pickup` hoac `dropoff`
- dam bao co `lat`, `lng`, `locationName`

#### `reverseGeocodeWithNominatim`

- goi API reverse geocode bang lat/lng

#### `normalizeNominatimSearchResult`

- chuan hoa ket qua search dia chi

#### `searchAddressWithNominatim`

- tim dia chi tu text nguoi dung nhap

#### `reverseGeocodeCoordinates`

- wrapper dung de frontend goi endpoint reverse geocode thong qua backend

Tai sao frontend khong goi thang Nominatim:

- tranh le thuoc truc tiep vao browser
- de backend kiem soat timeout, header, language, log
- de doi provider ve sau de hon

### 4.8 Validation booking

#### `validateBooking`

Day la ham validation quan trong nhat trong backend.

No kiem tra:

- `guestName` co hay khong
- `phone` neu co thi co hop le khong
- `passengerCount` co hop le khong
- `bookingType` co la `NOW` hoac `SCHEDULED` khong
- neu `SCHEDULED` thi `scheduledTime` co hop le khong
- `pickup` va `dropoff` co dung format khong

Neu payload sai, backend tra `400`.

Loi ich:

- frontend khong phai la lop bao ve duy nhat
- neu sau nay co app khac goi API nay, backend van an toan

### 4.9 Route Express chinh

#### `GET /`

- mo `booking.html`

#### `GET /booking.html`

- mo trang dat xe

#### `GET /status.html`

- mo trang theo doi task

#### `GET /api/location/reverse-geocode`

- frontend gui `lat/lng`
- backend tra ve thong tin dia chi da normalize

#### `GET /api/location/search`

- frontend gui `q`
- backend tra ve ket qua tim dia chi

#### `GET /api/health`

- route healthcheck cho Docker, monitoring va debug

#### `GET /api/system/logs`

- doc log moi nhat de debug

#### `POST /api/bookings`

Route quan trong nhat cua project.

Luong trong route nay:

1. doc body
2. validate
3. xu ly idempotency
4. goi dispatch server
5. tao booking local
6. tra response async cho frontend

#### `GET /api/bookings`

- lay lich su booking theo phone

#### `GET /api/bookings/:id`

Route nay phuc vu status page.

No:

- tim booking local
- neu co `taskId` thi co gang refresh tu dispatch
- merge du lieu
- tra lai object de UI render

### 4.10 `startServer`

Ham khoi dong Express server.

No:

- goi `ensureStorage`
- `listen` tren cong hien tai
- neu cong ban dau bi trung thi tu thu cong tiep theo
- ghi log URL startup

Day la diem vao chinh cua backend.

## 5. Frontend chi tiet - `public/js/booking.js`

Day la file lon nhat trong du an. Tot nhat nen doc theo nhom thay vi doc tu tren xuong.

File nay co 8 nhom logic:

1. Lay DOM element
2. Quan ly state
3. Utility va cache
4. Geocode va xu ly dia chi
5. GPS + map + smoothing
6. Validation
7. Booking history
8. Submit booking

### 5.1 DOM va element chinh

Ngay dau file, code lay cac element quan trong:

- `form`
- `submitButton`
- `requestOverlay`
- `toggleHistoryButton`
- `historyPanel`
- `detectLocationButton`
- `stopLocationButton`
- `locationFeedback`
- `gpsTrackerPanel`
- `gpsMapContainer`
- `fields`
- `errors`

Y nghia:

- `fields` la noi tap trung tat ca input de de thao tac
- `errors` la noi tap trung tat ca khu vuc hien loi validation

Dieu nay giup code ngan hon, tranh phai `getElementById` lap di lap lai.

### 5.2 Cac bien config quan trong trong `booking.js`

#### Form va request

- `PHONE_REGEX`: regex kiem tra so dien thoai
- `CACHE_KEY`: key localStorage de giu du lieu form
- `HISTORY_LIMIT`: so booking history toi da hien thi
- `HISTORY_AUTOLOAD_DELAY`: debounce khi tim lich su
- `STATUS_REDIRECT_DELAY_MS`: delay truoc khi nhay sang trang status
- frontend submit booking hien tai khong con tu dat timeout, `fetch` se `await` toi khi server tra response hoac mang loi that su

#### GPS va tracking

- `GPS_WATCH_OPTIONS`: config cho `navigator.geolocation.watchPosition`
- `GPS_MOVING_AVERAGE_WINDOW`: kich thuoc cua bo loc moving average
- `GPS_HYBRID_WINDOW`: cua so trung binh cho hybrid filter
- `GPS_FILTER_MODE`: che do loc hien tai
- `GPS_MAX_ACCEPTED_ACCURACY_METERS`: nguong do chinh xac toi da de chap nhan mau GPS
- `GPS_MAX_REASONABLE_SPEED_MPS`: toc do toi da hop ly de loai diem nhay bat thuong
- `GPS_MARKER_LERP`: he so noi suy marker de map di chuyen muot
- `GPS_CAMERA_UPDATE_INTERVAL_MS`: tan suat cap nhat camera map
- `GPS_SLOW_UPDATE_AFTER_MS`: neu qua lau khong co mau moi, hien canh bao
- `GPS_TRACK_POINT_LIMIT`: so diem track giu tren map
- `GPS_MATCH_POINT_LIMIT`: so diem gui qua OSRM de snap duong
- `GPS_MATCH_INTERVAL_MS`: tan suat goi snap duong
- `GPS_OSRM_MATCH_URL`: endpoint map matching mien phi

### 5.3 Cac state bien quan trong

#### Trang thai UI

- `historyLookupTimer`
- `isHistoryPanelOpen`
- `isResolvingLocation`
- `hasSubmitted`
- `touchedFields`

#### Trang thai pickup text va GPS

- `isPickupAreaUserEdited`: danh dau user da sua tay pickup hay chua
- `shouldForceGpsPickupAutofill`: dung de quyet dinh luc nao GPS duoc phep de lai pickup
- `deviceLocationSnapshot`: snapshot cuoi cung cua vi tri thiet bi
- `pickupAreaContext`: ngu canh dia chi tim duoc tu GPS/geocode, dung de tim kiem tot hon

#### Trang thai map

- `locationMap`
- `locationMarker`
- `locationMatchedMarker`
- `locationAccuracyCircle`
- `locationRawTrackLine`
- `locationFilteredTrackLine`
- `locationMatchedTrackLine`
- `locationWatchId`
- `locationAnimationFrameId`
- `isLocationTrackingActive`
- `locationTargetPoint`
- `locationRenderedPoint`
- `locationLastAcceptedSample`
- `locationLatestSample`
- `locationLatestFilteredPoint`
- `locationLatestMatchedPoint`

Nhung bien nay quan trong vi no giu toan bo bo nho tam thoi cua GPS tracking.

### 5.4 Utility va cache

#### `formatDateTimeLocal`

- format date sang kieu local de dua vao input datetime-local

#### `formatDisplayDateTime`

- format date de hien thi tren UI

#### `escapeHtml`

- tranh loi XSS khi render text vao HTML

#### `parseResponse`

- doc response fetch an toan
- backend co luc tra JSON, co luc tra text loi
- ham nay giup frontend xu ly ca hai

#### `setDateDefaults`

- dat gia tri mac dinh cho input gio hen

#### `loadCache`

- doc du lieu form da luu tu localStorage

#### `saveCache`

- luu du lieu form hien tai vao localStorage

#### `updateSummary`

- cap nhat nhan summary pickup tren giao dien

#### `setLocationFeedback`

- hien thong bao cho vung GPS/map
- co cac loai `info`, `warning`, `error`, `success`

#### `setLocationLoadingState`

- bat/tat loading UI cua GPS

#### `buildLocationPermissionDeniedMessage`

- tao thong diep than thien khi browser tu choi quyen vi tri

#### `buildCoordinateLabel`

- tao chuoi `Lat/Lng` de hien thi khi can

### 5.5 Cac ham xu ly dia chi

Muc tieu cua nhom nay:

- khong pha text nguoi dung nhap
- van co the tim toa do
- tan dung context GPS khi co
- fallback tot hon khi search khong tim duoc ngay

#### `extractLocationName`

- rut ten dia diem de doc hon tu payload geocode

#### `extractFullAddress`

- rut dia chi day du tu payload

#### `splitAddressSegments`

- tach dia chi thanh tung doan bang dau phay

#### `normalizeAddressText`

- lam sach text dia chi

#### `normalizeAddressSearchKey`

- tao key so sanh de tranh lap phan doan dia chi

#### `mergeAddressSegments`

- ghep cac segment dia chi, bo lap

#### `getAddressContextSegments`

- lay ra ward, district, city, country tu payload geocode

#### `buildPreferredPickupLabel`

- tao label pickup uu tien text cua user, sau do moi can nhac context

#### `buildPickupAreaSearchQuery`

- tao search query mac dinh cho pickup

#### `buildAddressSearchCandidates`

Mot trong nhung ham frontend quan trong nhat cho UX nhap dia chi.

Ham nay tao ra nhieu query tim kiem tu cung mot text nguoi dung nhap.

Vi du:

- user nhap `Kiet 515 Hoang Dieu`
- ham co the sinh ra cac candidate:
  - chuoi goc
  - chuoi goc + context tu GPS
  - chuoi goc + `Da Nang`
  - chuoi goc + `Viet Nam`

Muc dich:

- tang co hoi geocode dung
- nhung van khong sua text goc cua user

#### `searchLocationByAddressCandidates`

- thu tung query mot cho den khi co ket qua

#### `SERVICE_AREA_FALLBACKS`

- danh sach cac diem fallback trong khu vuc dich vu

Vi du:

- Da Nang center
- Hoi An center

#### `inferServiceAreaFallbackPoint`

- neu khong tim duoc toa do chinh xac, doan mot diem trung tam hop ly dua tren text va context

Y nghia UX:

- tranh chan cuoc dat xe qua som
- van cho dat neu nguoi dung nhap dia chi hop ly trong pham vi dich vu

#### `resolveLocationDetails`

- goi backend reverse geocode tu `lat/lng`

#### `setPickupAreaValue`

- cap nhat input pickup
- co logic de khong de GPS de len text nguoi dung da sua tay

#### `buildResolvedPickupLabel`

- chon label dep nhat tu ket qua reverse geocode

#### `searchLocationByAddress`

- goi backend search geocode tu text

#### `shouldRefreshResolvedPickup`

- quyet dinh co can reverse geocode lai hay khong

#### `resolvePickupAreaFromPoint`

Day la ham rat quan trong.

Nhiem vu:

- nhan vao mot diem `lat/lng`
- reverse geocode diem do
- cap nhat `pickupAreaContext`
- neu duoc phep thi fill vao input pickup

Day la cau noi giua GPS/map va pickup input.

### 5.6 Xay dung payload booking

#### `getBookingReference`

- lay `taskId` hoac `id` de hien thi lich su

#### `getBookingPickupLabel`

- lay `pickup.locationName`

#### `getBookingDropoffLabel`

- lay `dropoff.locationName`

#### `getBookingPassengerCount`

- lay so khach

#### `getBookingPickupTime`

- lay thoi gian don uu tien tu `scheduledTime`, `pickupTime`, `startTime`

#### `getCurrentPickupFallbackPoint`

- tim diem fallback hien tai de submit neu geocode pickup khong dung duoc

#### `buildBookingPointPayload`

Day la ham co gia tri nghiep vu lon nhat trong frontend.

Nhiem vu:

1. nhan `locationName` la text user nhap
2. uu tien giu nguyen `locationName`
3. co gang tim `lat/lng` bang:
   - GPS snapshot
   - geocode
   - context geocode
   - fallback khu vuc
4. tra object chuan:

```json
{
  "lat": 16.12,
  "lng": 108.30,
  "locationName": "Dia chi user nhap"
}
```

Day la ly do vi sao du nguoi dung khong bam GPS, he thong van co kha nang booking bang dia chi text.

### 5.7 GPS smoothing va tracking

Phan nay giup map muot hon va giam nhay vi tri.

#### `class LiveMovingAverageFilter`

Bo loc trung binh cong.

Y tuong:

- luu mot cua so gom nhieu mau GPS lien tiep
- lay gia tri trung binh

Tac dung:

- giam nhieu GPS nhe
- de hieu
- re de tinh toan

#### `class LiveScalarKalmanFilter`

Bo loc Kalman don gian cho mot truc gia tri.

Y nghia:

- moi mau GPS moi deu co nhieu
- Kalman giup can bang giua:
  - gia tri do duoc
  - uoc luong trang thai hien tai

No khong than ky, nhung rat huu ich de marker bot nhay.

#### `class LivePositionKalmanFilter`

- gop 2 bo loc scalar cho `lat` va `lng`

Tuc la:

- mot bo loc cho vi do
- mot bo loc cho kinh do

#### `resetLiveGpsFilters`

- reset tat ca bo loc khi bat dau session GPS moi

#### `haversineDistanceMeters`

- tinh khoang cach thuc te giua 2 diem tren trai dat

Dung de:

- phat hien diem nhay bat thuong
- tinh toc do di chuyen

#### `acceptLiveGpsSample`

Ham nay quyet dinh mot sample GPS co nen duoc chap nhan hay khong.

No kiem tra:

- `accuracy` co qua te khong
- toc do tu diem cu sang diem moi co vo ly khong

Neu khong hop ly, bo qua sample.

Day la lop phong thu dau tien de giam nhay.

#### `getLiveFilteredPoint`

- ap moving average + Kalman de tao diem da loc

#### `setLiveGpsTargetPoint`

- cap nhat diem dich ma marker can di toi

#### `ensureLiveGpsAnimationLoop`

- dung `requestAnimationFrame` de noi suy marker
- giup marker khong giat tung doan theo tung sample GPS

#### `updateGpsAccuracyCircle`

- cap nhat vong tron accuracy tren map

#### `scheduleSlowGpsUpdateWarning`

- neu lau khong co update, hien canh bao cho user

#### `requestFreeRoadSnap`

- gui du lieu track toi OSRM de snap ve gan duong

Y nghia:

- GPS co the nam giua toa nha, via he, hoac lech nhe
- map matching giup marker nam hop ly hon tren duong

#### `applyLiveGpsSample`

Day la ham tong hop du lieu GPS.

No:

1. nhan sample raw
2. loc
3. cap nhat track
4. cap nhat marker
5. cap nhat accuracy circle
6. cap nhat snapshot
7. reverse geocode pickup khi can
8. co the goi snap duong

#### `handleLiveGpsSuccess`

- callback cho `watchPosition`
- chuyen `position` cua browser thanh format noi bo

#### `handleLiveGpsError`

- callback khi GPS loi
- hien thong diep de user hieu

#### `startLiveLocationTracking`

Ham bat GPS.

No:

- bat loading
- dam bao map da duoc tao
- reset state can thiet
- goi `navigator.geolocation.watchPosition`
- cho phep auto-fill pickup bang GPS

#### `stopLiveLocationTracking`

- dung watch GPS
- dung animation neu can
- reset state UI lien quan

### 5.8 Map va thao tac tren map

#### `createLeafletMarker`

- tao marker Leaflet voi class CSS rieng

#### `applyManualMapSelection`

- khi user cham map hoac keo marker
- he thong coi do la diem pickup user chon
- reverse geocode diem nay va co the fill pickup area

#### `focusMapOnAddressResult`

- dua map den ket qua geocode tim duoc

#### `syncPickupAreaToMap`

Ham quan trong cho truong hop user nhap dia chi tay.

No:

1. doc text pickup hien tai
2. goi geocode
3. neu co ket qua thi dua map/marker den do
4. neu khong thi co the fallback theo khu vuc
5. khong nhat thiet sua text user

#### `ensureGpsMap`

- khoi tao Leaflet map neu chua co
- dang ky su kien click map

#### `redrawGpsMap`

- sua lai kich thuoc map khi panel thay doi

#### `resetLiveGpsState`

- reset cac bien track, marker, filter va snapshot lien quan GPS

#### `buildLiveDeviceLocationSnapshot`

- tao object snapshot chuan tu sample raw, filtered va matched point

Snapshot nay duoc dung khi submit booking.

### 5.9 Validation form

#### `updateScheduledFieldState`

- neu `pickupTimeMode = NOW` thi an/disable truong gio hen
- neu `SCHEDULED` thi bat truong gio hen

#### `showFieldState`

- bat/tat loi cho tung input

#### `validateForm`

Ham validation frontend chinh.

Kiem tra:

- ten
- phone
- pickup
- dropoff
- scheduled time neu can

Tra ve `true/false` de quyet dinh co duoc submit hay khong.

### 5.10 Booking history

#### `setHistoryFeedback`

- thong bao cho panel history

#### `renderHistoryEmpty`

- hien giao dien khi chua co lich su

#### `renderHistoryList`

- render danh sach booking history

#### `setHistoryLoading`

- loading cho history panel

#### `setHistoryPanelState`

- mo dong panel history

#### `loadBookingHistory`

- goi `/api/bookings?phone=...`

#### `scheduleHistoryLookup`

- debounce khi user nhap phone de xem lich su

### 5.11 Overlay va submit booking

#### `openOverlay`

- mo modal trang thai
- dung cho loading, success, error

#### `closeOverlay`

- dong modal

#### `redirectToStatusPage`

- chuyen sang `status.html?task_id=...`

#### `setLoadingState`

- khoa mo form khi dang submit

#### `form.addEventListener('submit', async ...)`

Day la block nghiep vu lon nhat cua frontend.

Luong chinh:

1. ngan submit mac dinh
2. validate form
3. mo overlay dang gui
4. neu chua dung GPS nhung co pickup text thi sync map mot lan nua
5. build `pickup` payload
6. build `dropoff` payload
7. build booking request JSON
8. `POST /api/bookings`
9. nhan response `taskId`
10. hien overlay thanh cong
11. redirect sang status page

Neu loi:

- hien overlay loi
- giu user o lai form de sua

### 5.12 Event listener cuoi file

Cuoi file co cac event listener quan trong:

- input/change cua fields de save cache va validate
- `pickupArea`:
  - `Enter` -> sync map
  - `blur` -> sync map
- `detectLocationButton` -> bat GPS
- `stopLocationButton` -> tat GPS
- `historyPhoneInput` -> autoload history
- `window.pagehide` -> dung GPS khi roi trang

Cuoi cung, file chay khoi tao:

- `loadCache()`
- `setDateDefaults()`
- `updateScheduledFieldState()`
- `updateSummary()`
- `validateForm()`
- `setLocationFeedback(...)`
- `renderHistoryEmpty(...)`
- `setHistoryPanelState(false)`

Day la ly do khi mo trang lan dau, form da co trang thai san sang.

## 6. Trang status - `public/js/status.js`

File nay gon hon nhieu, chu yeu de poll va render.

### Bien chinh

- `POLL_INTERVAL_MS = 5000`: moi 5 giay goi lai API
- `taskId`: doc tu URL
- `elements`: gom tat ca DOM can cap nhat

### Ham chinh

#### `formatDateTime`

- format thoi gian theo `vi-VN`
- ep `timeZone = 'Asia/Ho_Chi_Minh'`

#### `setFeedback`

- hien banner loi neu load status that bai

#### `getStatusLabel`

- lay status booking, mac dinh `PENDING_BROADCAST`

#### `isAcceptedBooking`

- kiem tra booking da co tai xe nhan chua

#### `getAssignedVehicle`

- neu chua co xe thi hien `Waiting`

#### `getEtaText`

- format `estimatedPickupSeconds`

#### `setSpotlightState`

Ham giao dien quan trong nhat cua status page.

No doi giao dien dau trang dua tren status:

- `PENDING_BROADCAST` -> `Finding driver`
- `ACCEPTED` -> `Driver found`

#### `setDetailEmphasis`

- highlight cac card quan trong khi da co tai xe

#### `renderBooking`

- dua du lieu booking len UI

Day la ham render chinh cua trang status.

#### `loadStatus`

- goi `/api/bookings/:taskId`
- parse JSON
- neu thanh cong thi `renderBooking`
- neu that bai thi `setFeedback`

Cuoi file:

- goi `loadStatus()` ngay khi vao trang
- `setInterval(loadStatus, POLL_INTERVAL_MS)`

## 7. Theme - `public/js/theme.js`

File nay nho, nhung huu ich de hieu style state.

### Bien chinh

- `storageKey = 'buggy-booking-theme'`
- `root = document.documentElement`
- `toggleButtons`
- `toggleLabels`

### Ham chinh

#### `applyTheme`

- gan `data-theme` vao root HTML
- luu theme vao `localStorage`
- doi text nut theme

Luong:

1. vao trang
2. doc theme cu tu localStorage
3. ap theme
4. khi bam nut theme, doi giua `dark` va `light`

## 8. Logger - `lib/logger.js`

Muc dich cua file nay la cung cap logger tu tao, thay vi dung thu vien log ngoai.

### Cac ham utility chinh

#### `pad`

- them so 0 o dau cho date/time

#### `formatTimestamp`

- tao timestamp co ca timezone offset

#### `getDailyLogName`

- tao ten file log theo ngay

#### `formatPrimitive`

- chuyen so, boolean, string thanh chuoi de ghi log gon hon

#### `formatCompactObject`

- format object ngan gon bang `util.inspect`

#### `formatField`

- tao cap `key=value`

#### `joinFields`

- ghep nhieu field log bang dau `|`

#### `buildCategory`

- doan category log dua tren message

#### `buildSummary`

- tao dong tom tat log cho tung loai su kien

Day la ly do log hien nay doc de hieu hon rat nhieu.

#### `extractExtraDetails`

- lay them meta phu neu can

#### `formatErrorMeta`

- format error va stack trace

#### `createLogger`

Ham chinh cua file nay.

No tra ve object:

- `info`
- `warn`
- `error`
- `debug`
- `getLatestLogPath`
- `getLogDir`

Backend `server.js` goi ham nay mot lan luc khoi dong.

## 9. Docker va config

### 9.1 `config/app.config.json`

Day la file config chinh cua he thong.

Nhung bien quan trong nhat:

- `server.port`
- `storage.databaseFile`
- `storage.logDir`
- `dispatch.baseUrl`
- `geocoding.reverseGeocodeUrl`
- `geocoding.searchGeocodeUrl`
- `http.locationTimeoutMs`
- `http.dispatchTimeoutMs`
- `booking.maxPendingBookings`
- `booking.idempotencyTtlMs`

File [config/index.js](/c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/config/index.js) la noi doc, validate va normalize file config nay.

### 9.2 `Dockerfile`

Muc tieu:

- tao image Node don gian cho booking server

Luong:

1. dung `node:24-alpine`
2. copy `package*.json`
3. `npm ci --omit=dev`
4. copy `config`, `server.js`, `lib`, `public`
5. tao folder data/logs
6. expose port `3000`
7. healthcheck `/api/health`
8. chay `npm start`

### 9.3 `docker-compose.yml`

File compose hien tai chi can service `buggy-booking-system`.

#### `buggy-booking-system`

- service chinh cua booking web
- expose `3000:3000`
- mount `./config:/app/config:ro`
- mount `./data:/app/data`
- co `extra_hosts` de container co the goi `host.docker.internal` khi can

Y nghia:

- backend booking khong can biet server phia sau la local hay production
- ban chi can doi `dispatch.baseUrl` trong file config

## 10. Cach doi URL dispatch server

Ban chi can sua `dispatch.baseUrl` trong `config/app.config.json`.

Vi du:

```json
{
  "dispatch": {
    "baseUrl": "https://your-real-server.example.com"
  }
}
```

Neu chay `npm start` va dispatch server nam tren may host:

```json
{
  "dispatch": {
    "baseUrl": "http://localhost:4001"
  }
}
```

Neu chay `docker compose up --build` va dispatch server nam tren may host:

```json
{
  "dispatch": {
    "baseUrl": "http://host.docker.internal:4001"
  }
}
```

Sau do restart `buggy_booking_system`.

Tai sao he thong linh hoat:

- frontend khong can biet dispatch server la ai
- frontend chi goi backend booking
- backend booking doc `config/app.config.json` va forward toi dung server do

## 11. Schema JSON quan trong

### 11.1 Request booking

```json
{
  "guestName": "Nguyen Van A",
  "phone": "0901234567",
  "passengerCount": 2,
  "bookingType": "NOW",
  "scheduledTime": null,
  "pickup": {
    "lat": 16.1205,
    "lng": 108.3061,
    "locationName": "La Maison 1888"
  },
  "dropoff": {
    "lat": 16.1215,
    "lng": 108.3080,
    "locationName": "Bai bien Bac"
  }
}
```

### 11.2 Response async khi vua tao booking

```json
{
  "taskId": "BKG-20260319-3443D3",
  "status": "PENDING_BROADCAST",
  "message": "Da phat tin hieu den cac tai xe gan nhat, dang cho tai xe nhan cuoc..."
}
```

### 11.3 Response status khi da co tai xe

```json
{
  "taskId": "BKG-20260319-3443D3",
  "status": "ACCEPTED",
  "assignedVehicle": "buggy02",
  "estimatedPickupSeconds": 60.5,
  "message": "Xe buggy02 dang den!"
}
```

## 12. Luong submit booking mot cach cuc ky cu the

Day la luong chi tiet nhat de ban doc code:

1. User nhap form.
2. `validateForm()` chay de kiem tra UI.
3. Neu user bam `Use GPS`, `startLiveLocationTracking()` duoc goi.
4. Browser bat dau `watchPosition`.
5. Moi sample vao:
   - `handleLiveGpsSuccess()`
   - `normalizeLiveGpsPosition()`
   - `acceptLiveGpsSample()`
   - `getLiveFilteredPoint()`
   - `applyLiveGpsSample()`
6. `applyLiveGpsSample()` cap nhat map, marker, accuracy, snapshot, va co the fill pickup.
7. Khi user submit:
   - `form.addEventListener('submit', ...)`
   - `fetch('/api/bookings', ...)`
8. Truoc khi gui:
   - build `pickup` bang `buildBookingPointPayload()`
   - build `dropoff` bang `buildBookingPointPayload()`
9. Frontend goi `POST /api/bookings`.
10. Backend vao route `app.post('/api/bookings', ...)`.
11. Backend `validateBooking()`.
12. Backend `createDispatchBooking()`.
13. Backend `createBookingSafely()`.
14. Backend tra `taskId`.
15. Frontend `redirectToStatusPage(taskId)`.
16. `status.js` vao `loadStatus()`.
17. Moi 5 giay poll `GET /api/bookings/:taskId`.
18. Backend `fetchDispatchBookingStatus()`.
19. Backend `mergeBookingWithDispatchState()`.
20. Frontend `renderBooking()` va cap nhat UI.

## 13. Tai sao code duoc to chuc theo cach nay

### 13.1 Tach frontend va backend ro rang

- frontend lo UI, GPS, map, form
- backend lo validate, geocode proxy, dispatch proxy, storage

Loi ich:

- de doi dispatch server
- de thay geocode provider
- de debug tung lop

### 13.2 Frontend giu text nguoi dung, backend giu schema chuan

Ban da uu tien trai nghiem nguoi dung: neu user nhap dia chi tay, he thong khong nen sua text mot cach kho chiu.

Vi vay:

- input giu text user
- map va geocode ho tro xac dinh toa do o phia sau
- payload cuoi cung van co `locationName` dung y user

### 13.3 Co fallback de khong chan booking qua som

Neu geocode that bai hoan toan, he thong van co mot so fallback khu vuc de:

- tang ti le dat thanh cong
- tranh thong diep loi qua nang
- cho phep nghiep vu tiep tuc, nhat la khi user dang o khu vuc dich vu ro rang

## 14. Debug va cach doc loi

### 14.1 Neu booking bi dung o overlay dang gui

Kiem tra:

1. `dispatch.baseUrl` co dung khong
2. dispatch server dich co dang chay khong
3. neu muon cho vo han thi `http.dispatchTimeoutMs` phai la `null`
4. log trong `data/logs/latest.log`

### 14.2 Neu GPS khong chay

Kiem tra:

1. trang co chay bang `localhost` hoac `https` khong
2. browser co cho phep location khong
3. tren iPhone co bat precise location khong

### 14.3 Neu input pickup nhap tay ma khong map duoc

Kiem tra:

1. backend route `/api/location/search` co song khong
2. `SEARCH_GEOCODE_URL` co dung khong
3. text dia chi co ro thanh pho/khu vuc hay khong
4. fallback khu vuc co duoc kich hoat khong

### 14.4 Neu status khong doi sang `ACCEPTED`

Kiem tra:

1. `GET /api/bookings/:taskId` co tra `success=true` khong
2. dispatch server co tra `assignedVehicle` va `estimatedPickupSeconds` khong
3. trang status co dung `task_id` tren URL khong

## 15. Goi y cach doc code neu ban muon hieu nhanh

Neu muon doc code theo thu tu de hieu nhanh nhat, nen doc:

1. `README.md`
2. `server.js`
3. `public/js/status.js`
4. `public/js/booking.js`
5. `lib/logger.js`
6. `docker-compose.yml`
7. `Dockerfile`

Ly do:

- `server.js` cho ban thay nghiep vu backend tong quat
- `status.js` rat gon, de hieu luong poll
- `booking.js` lon nhat, nen doc sau khi da hieu backend va status

## 16. Ket luan

Neu tom tat lai chi bang mot cau:

He thong nay la mot web booking co GPS/map ho tro pickup, gui request dat xe theo kieu async toi dispatch server, luu booking local de debug va lich su, sau do poll task status de hien thi qua trinh tim tai xe va thong tin tai xe nhan cuoc.

Neu ban muon, buoc tiep theo minh co the viet them cho ban:

1. Mot `Developer Guide` giai thich theo tung dong route trong `server.js`
2. Mot `Sequence Diagram` bang text de ban nhin luong frontend -> backend -> dispatch server -> status page
3. Mot `API Manual` rieng, tach khoi User Manual nay

Xem database: 
cd c:\Users\OS\Desktop\hieu\Python_BE\buggy_booking_system
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('./data/bookings.db'); console.log(db.prepare('SELECT COUNT(*) AS count FROM bookings').get()); console.log(db.prepare('SELECT id, task_id, guest_name, status, created_at FROM bookings ORDER BY datetime(created_at) DESC LIMIT 10').all());"

Code general QR: 
python C:\Users\admin\Desktop\DESKTOP_HIEU\hieu\tools\generate_booking_qr.py " https://488b-113-176-99-209.ngrok-free.app" -o C:\Users\admin\Desktop\DESKTOP_HIEU\hieu\buggy_booking_system\public\img\booking-qr.png 
