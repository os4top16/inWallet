'use strict';


angular.module('copayApp.controllers').controller('diceWinController',
    function ($rootScope, $scope, $timeout, storageService, notification, profileService, bwcService, $log, $stateParams, gettext, gettextCatalog, lodash, go, isCordova) {
        let self = this;
        let MaxAmount = 100000;
        //  可下注最大值
        let MinAmount = 1       //  可下注最小值

        let payment = require('inWalletcore/payment.js')
        let light = require('inWalletcore/light.js')
        var utils = require('inWalletcore/utils.js');
        self.paymentList = [50, 100, 200]                               // 可选金额列表
        self.address = $scope.index.walletType.INVE[0].address;         // 获取第一个INVE地址
        self.walletId = $scope.index.walletType.INVE[0].wallet;
        self.contAddress = '7BAFONS5IUA3XH4C62ZHXEZSXBZSMJYX';

        self.Magnification = 1.96                                       //  倍率

        self.diceData = {
            type: '0',                                                  // 0正 1反
            amount: MinAmount                                           //  下注金额
        }                                                               // 下注所需数据

        self.amountActiveIndex = -2                                     //  金额选中

        self.diceGameList = []
        self.isNoMore = false  // 是否还有更多
        self.isLoading = false  // 是否展示加载中
        // 中奖记录分页
        let page = 1, pageSize = 10


        // 金额选中效果
        self.amountActive = function (index, value) {
            self.amountActiveIndex = index
            if (index === -1) {
                //    最大值
                self.diceData.amount = MaxAmount
            } else {
                self.diceData.amount = value
            }
        }

        // 金额加
        self.amountAdd = function () {
            if (self.diceData.amount < MaxAmount) {
                self.diceData.amount++
            }
        }

        // 金额减
        self.amountCut = function () {
            if (self.diceData.amount > MinAmount) {
                self.diceData.amount--
            }
        }


        //   输入amountChange

        self.amountChange = function () {
            if ((typeof (self.diceData.amount) === "number") && (self.diceData.amount !== Infinity) && !isNaN(self.diceData.amount)) {
                if (self.diceData.amount > MaxAmount) {
                    self.diceData.amount = MaxAmount
                } else if (self.diceData.amount < MinAmount) {
                    self.diceData.amount = MinAmount
                } else {
                    self.diceData.amount = parseInt(self.diceData.amount)
                }
            } else {
                self.diceData.amount = MinAmount
            }
        }

        // 计算 预计总额

        //  下注
        self.Bets = function () {
            if (self.diceGameList.length) {
                if (self.diceGameList[0].result === 'pending') {
                    $rootScope.$emit('Local/ShowErrorAlert', gettextCatalog.getString('Waiting for the result of the last bet'));
                } else {
                    $scope.index.payController = true;
                    apply();
                }
            } else {
                $scope.index.payController = true;
                apply();
            }
        }

        //  确认支付
        self.confirmPay = function () {
            $scope.index.payController = false;
            profileService.setAndStoreFocusToWallet(self.walletId, function () {
                profileService.unlockFC(null, function (err) {
                    if (err) {
                        $rootScope.$emit('Local/ShowErrorAlert', gettextCatalog.getString('Wrong password'));
                        return;
                    }
                    let fc = profileService.focusedClient;
                    let pubkey = utils.getPubkey(fc.credentials.xPrivKey);
                    console.warn('walletClients: ', fc.credentials);

                    let obj = {
                        fromAddress: self.address,
                        toAddress: self.contAddress,
                        amount: self.diceData.amount,
                        callData: self.diceData.type,
                        pubkey: pubkey,
                        xprivKey: fc.credentials.xPrivKey
                    }

                    console.warn('合约交易构造传递前的数据格式')
                    console.log(obj)
                    //  构造合约交易
                    payment.contractTransactionData(obj, function (err, res) {
                        console.error(res)
                        console.error(err)
                        if (err) {
                            if (err.match(/not enough spendable/)) {
                                err = gettextCatalog.getString("not enough spendable");
                            }
                            if (err.match(/unable to get nrgPrice/)) {
                                err = gettextCatalog.getString("network error,please try again.");
                            }
                            return $rootScope.$emit('Local/ShowErrorAlert', err);
                        } else {

                            //     发送合约交易
                            payment.sendTransactions(res, function (err, res) {
                                console.warn('发送交易后返回的数据')
                                console.log(err)
                                console.log(res)
                                if (err) {
                                    return $rootScope.$emit('Local/ShowErrorAlert', err);
                                } else {
                                    $rootScope.$emit('Local/ShowErrorAlert', gettextCatalog.getString('Payment Success'));
                                    self.getDiceList()
                                    self.cancelPay()
                                }
                            })
                        }
                    })
                });
            });
        }

        //  取消支付
        self.cancelPay = function () {
            $scope.index.payController = false;
        }


        // 页面渲染
        function apply() {
            setTimeout(function () {
                $scope.$apply();
            });
        }

        //查询中奖记录
        self.getDiceList = function () {
            light.getDiceWin(self.contAddress, page, pageSize, function (res) {
                console.log(res)
                self.diceGameList = res
                // apply()
            })
        }

        self.getDiceList()


        /***
         *
         *
         * //  下拉加载更多功能
         *
         * */
        //获取滚动条当前的位置
        function getScrollTop() {
            var scrollTop = 0;
            if (document.documentElement && document.documentElement.scrollTop) {
                scrollTop = document.documentElement.scrollTop;
            } else if (document.getElementById('cwpage')) {
                scrollTop = document.getElementById('cwpage').scrollTop;
            }
            return scrollTop;
        }

        //获取当前可视范围的高度
        function getClientHeight() {
            var clientHeight = 0;
            if (document.getElementById('cwpage').clientHeight && document.documentElement.clientHeight) {
                clientHeight = Math.min(document.getElementById('cwpage').clientHeight, document.documentElement.clientHeight);
            } else {
                clientHeight = Math.max(document.getElementById('cwpage').clientHeight, document.documentElement.clientHeight);
            }
            return clientHeight;
        }

        //获取文档完整的高度
        function getScrollHeight() {
            return Math.max(document.getElementById('cwpage').scrollHeight, document.getElementById('cwpage').scrollHeight);
        }

        //滚动事件触发
        document.getElementById('cwpage').onscroll = function () {
            // console.log('滚动')
            // console.warn('滚动条当前的位置')
            // console.log(getScrollTop())
            // console.warn('可视范围的高度')
            // console.log(getClientHeight())
            // console.warn('完整的高度')
            // console.log(getScrollHeight())
            if (getScrollTop() + getClientHeight() == getScrollHeight()) {
                console.log('到底了？')

                if (pageSize > self.diceGameList.length) {
                    self.isNoMore = true
                } else {
                    if (self.isNoMore) {

                    } else {
                        pageSize += 10
                        self.isLoading = true
                        setTimeout(() => {
                            self.getDiceList()
                            self.isLoading = false
                        }, 1000)
                    }
                }
            }

        }


        /**
         * 新增交易记录时，同步更新交易记录显示
         */
        var transactionUpdate = $rootScope.$on('Local/transactionUpdate', function () {
            page = 1
            pageSize = 10
            self.getDiceList()
        });

        $scope.$on('$destroy', function () {
            transactionUpdate();
        });
    });
