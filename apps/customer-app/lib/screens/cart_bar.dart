import 'package:flutter/material.dart';

import '../main.dart';
import '../theme.dart';
import '../util/format.dart';
import 'checkout.dart';

/// "View cart" bar shown at the bottom while the cart has items.
class CartBar extends StatelessWidget {
  const CartBar({super.key});
  @override
  Widget build(BuildContext context) {
    final cart = AppScope.of(context).cart;
    if (cart == null || cart.isEmpty) return const SizedBox.shrink();
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: FilledButton(
          style: FilledButton.styleFrom(backgroundColor: SK.ink),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutScreen())),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: SK.orange, borderRadius: BorderRadius.circular(999)),
              child: Text('${cart.count}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text('View cart · ${cart.restaurantName}', overflow: TextOverflow.ellipsis)),
            Text(usd(cart.subtotalCents)),
          ]),
        ),
      ),
    );
  }
}
