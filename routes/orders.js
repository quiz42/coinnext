(function() {
  var JsonRenderer, Order, Wallet, _;

  Order = require("../models/order");

  Wallet = require("../models/wallet");

  JsonRenderer = require("../lib/json_renderer");

  _ = require("underscore");

  module.exports = function(app) {
    var isValidTradeAmount;
    app.post("/orders", function(req, res) {
      var data;
      if (req.user) {
        if (req.user.canTrade()) {
          data = req.body;
          data.user_id = req.user.id;
          if (!isValidTradeAmount(data.amount)) {
            return JsonRenderer.error("Please submit a valid amount bigger than 0.", res);
          }
          return Wallet.findOrCreateUserWalletByCurrency(req.user.id, data.buy_currency, function(err, buyWallet) {
            if (err || !buyWallet) {
              return JsonRenderer.error("Wallet " + data.buy_currency + " does not exist.", res);
            }
            return Wallet.findOrCreateUserWalletByCurrency(req.user.id, data.sell_currency, function(err, wallet) {
              if (err || !wallet) {
                return JsonRenderer.error("Wallet " + data.sell_currency + " does not exist.", res);
              }
              return wallet.holdBalance(parseFloat(data.amount), function(err, wallet) {
                if (err || !wallet) {
                  return JsonRenderer.error("Not enough " + data.sell_currency + " to open an order.", res);
                }
                return Order.create(data, function(err, order) {
                  if (err) {
                    return JsonRenderer.error("Sorry, could not open an order...", res);
                  }
                  return res.json(JsonRenderer.order(order));
                });
              });
            });
          });
        } else {
          return JsonRenderer.error("Sorry, but you can not trade. Did you verify your account?", res);
        }
      } else {
        return JsonRenderer.error("You need to be logged in to place an order.", res);
      }
    });
    app.get("/orders", function(req, res) {
      return Order.findByOptions(req.query, function(err, orders) {
        if (err) {
          return JsonRenderer.error("Sorry, could not get open orders...", res);
        }
        return res.json(JsonRenderer.orders(orders));
      });
    });
    app.del("/orders/:id", function(req, res) {
      if (req.user) {
        return Order.findOne({
          user_id: req.user.id,
          _id: req.params.id
        }, function(err, order) {
          if (err || !order) {
            return JsonRenderer.error("Sorry, could not delete orders...", res);
          }
          return Wallet.findUserWalletByCurrency(req.user.id, order.sell_currency, function(err, wallet) {
            return wallet.holdBalance(-order.amount, function(err, wallet) {
              return order.remove(function() {
                return res.json(JsonRenderer.orders(order));
              });
            });
          });
        });
      } else {
        return JsonRenderer.error("You need to be logged in to place an order.", res);
      }
    });
    return isValidTradeAmount = function(amount) {
      return _.isNumber(amount) && !_.isNaN(amount) && amount > 0;
    };
  };

}).call(this);