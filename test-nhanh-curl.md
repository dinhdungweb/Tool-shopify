# Test Nhanh API với curl

Theo tài liệu API, endpoint là:
```
POST https://pos.open.nhanh.vn/v3.0/customer/list
```

## Test command:

```bash
curl --location 'https://pos.open.nhanh.vn/v3.0/customer/list?appId=76522&businessId=170530' \
--header 'Authorization: 3gMdU1yt7zdpKqjJOvLKzx385Tjlu4OLjZ8X7973MCXtTVMIVt00G6ctMBl2KePKxnRbHOVDKyVfDfL491okfU55w0sb4yFPOOODi7nD1KiRuKNgk41vhCQLu3slVAfEYiufVdmrMDeCFIQEnIWba3H7JMHH5dnwfa01S1NSEYP4c7FPkRusSeErkfXyfK8G5aSZpYm3NBGuf7Rv3bHecFNvIzIVKf0' \
--header 'Content-Type: application/json' \
--data '{
  "filters": {
    "type": 1
  },
  "paginator": {
    "size": 10
  }
}'
```

Hoặc thử với body chứa appId:

```bash
curl --location 'https://pos.open.nhanh.vn/v3.0/customer/list' \
--header 'Content-Type: application/json' \
--data '{
  "appId": 76522,
  "businessId": 170530,
  "accessToken": "3gMdU1yt7zdpKqjJOvLKzx385Tjlu4OLjZ8X7973MCXtTVMIVt00G6ctMBl2KePKxnRbHOVDKyVfDfL491okfU55w0sb4yFPOOODi7nD1KiRuKNgk41vhCQLu3slVAfEYiufVdmrMDeCFIQEnIWba3H7JMHH5dnwfa01S1NSEYP4c7FPkRusSeErkfXyfK8G5aSZpYm3NBGuf7Rv3bHecFNvIzIVKf0",
  "filters": {
    "type": 1
  },
  "paginator": {
    "size": 10
  }
}'
```

## Kiểm tra response để xem cấu trúc đúng
