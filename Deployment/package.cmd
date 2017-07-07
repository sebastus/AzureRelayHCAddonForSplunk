set version=TA-AzureRelayHC-0_0_1
del packages\%version%.spl
del /Q temp\*.*
cd Deployment
7z a -ttar temp\%version%.tar TA-AzureRelayHC\bin\node_modules
7z a -ttar temp\%version%.tar TA-AzureRelayHC\bin\*.js
7z a -ttar temp\%version%.tar TA-AzureRelayHC\bin\*.sh
7z a -ttar temp\%version%.tar TA-AzureRelayHC\bin\package.json
7z a -ttar temp\%version%.tar TA-AzureRelayHC\default\*
7z a -ttar temp\%version%.tar TA-AzureRelayHC\README\*
7z a -ttar temp\%version%.tar TA-AzureRelayHC\LICENSE
7z a -ttar temp\%version%.tar TA-AzureRelayHC\README.md
copy temp\%version%.tar temp\%version%.spl
7z a -tgzip ..\packages\%version%.spl temp\%version%.spl
exit
