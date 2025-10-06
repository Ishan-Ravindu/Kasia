npm run tauri ios build -- --export-method app-store-connect

xcrun altool --upload-app --type ios --file "src-tauri/gen/apple/build/arm64/Kasia.ipa" --apiKey TYQUC8LB7M --apiIssuer 2112820b-84e8-472c-a7a9-f02ca92bb13d
