import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../config.dart';
import '../main.dart';
import '../theme.dart';
import 'address_sheet.dart';
import 'cart_bar.dart';
import 'restaurant.dart';
import 'widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<NearbyRestaurant>? list;
  String? error;
  String query = '';
  String? _loadedFor;
  Timer? _debounce;
  static const cravings = ['Biryani', 'Pizza', 'Halal', 'Burgers', 'Thai', 'Sushi', 'Vegan', 'Desserts'];

  Future<void> _load() async {
    final s = AppScope.read(context);
    final a = s.address;
    try {
      final r = await s.api.nearby(a?.lat ?? Config.fallbackLat, a?.lng ?? Config.fallbackLng, q: query);
      if (mounted) setState(() { list = r; error = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final a = AppScope.of(context).address;
    final key = '${a?.id}';
    if (key != _loadedFor) { _loadedFor = key; _load(); }
  }

  @override
  void dispose() { _debounce?.cancel(); super.dispose(); }

  void _open(NearbyRestaurant r) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RestaurantScreen(locationId: r.locationId, name: r.name)));

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final a = s.address;
    final visible = (list ?? const <NearbyRestaurant>[]).where((r) => s.mode == 'delivery' ? r.delivers : r.pickup).toList();
    final deals = visible.where((r) => deliveryOffer(r.deliveryRule) != null).toList();
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: InkWell(
          onTap: () => AddressSheet.open(context),
          child: Row(children: [
            const Logo(light: true, size: 20),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Deliver now to', style: TextStyle(fontSize: 11, color: Color(0xFFC9CBD1))),
              Text(a == null ? 'Add an address' : '${a.title} · ${a.line1}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            ])),
            const Icon(Icons.expand_more),
          ]),
        ),
      ),
      bottomNavigationBar: const CartBar(),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const Pill('Restaurants keep 100% of food sales'),
          const SizedBox(height: 10),
          const Text.rich(TextSpan(children: [
            TextSpan(text: 'Your favorite local food. '),
            TextSpan(text: 'Fairer', style: TextStyle(color: SK.orange)),
            TextSpan(text: ' for everyone.'),
          ]), style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.15)),
          const SizedBox(height: 6),
          const Text('Menu prices set by the restaurant. Every fee shown before you pay — and 100% of your tip goes to the courier.', style: TextStyle(color: SK.muted)),
          const SizedBox(height: 14),
          TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Restaurant or cuisine'),
            onChanged: (v) { _debounce?.cancel(); _debounce = Timer(const Duration(milliseconds: 300), () { query = v.trim(); _load(); }); },
          ),
          const SizedBox(height: 10),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'delivery', label: Text('Delivery'), icon: Icon(Icons.delivery_dining)), ButtonSegment(value: 'pickup', label: Text('Pickup'), icon: Icon(Icons.storefront))],
            selected: {s.mode},
            onSelectionChanged: (v) => s.setMode(v.first),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 38,
            child: ListView.separated(scrollDirection: Axis.horizontal, itemCount: cravings.length, separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => ActionChip(label: Text(cravings[i]), onPressed: () { query = cravings[i]; _load(); })),
          ),
          const SizedBox(height: 18),
          if (error != null) ErrorBanner(error!),
          if (list == null && error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (list != null && deals.isNotEmpty && query.isEmpty) ...[
            const Text('Free delivery near you', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
            const Text('Paid for by the restaurant — not added to your food price.', style: TextStyle(color: SK.muted)),
            const SizedBox(height: 10),
            for (final r in deals) ...[RestaurantTile(r: r, onTap: () => _open(r)), const SizedBox(height: 12)],
            const SizedBox(height: 6),
          ],
          if (list != null) ...[
            Text(query.isEmpty ? 'All restaurants' : 'Results for “$query”', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (visible.isEmpty) const Text('No restaurants here yet. We’re adding NYC restaurants every week.', style: TextStyle(color: SK.muted)),
            for (final r in visible) ...[RestaurantTile(r: r, onTap: () => _open(r)), const SizedBox(height: 12)],
          ],
        ]),
      ),
    );
  }
}
