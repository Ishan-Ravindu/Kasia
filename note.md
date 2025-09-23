* upload unsigned dev IPA:
xcrun altool --upload-app -f src-tauri/gen/apple/build/arm64/Kasia.ipa -u <user_email> -t iOS

* build unsigned IPA:
npm run tauri ios build -- --export-method release-testing
