# Send Koro — Stripe Developer Technical Brief (v1.2)

> Converted from the original Word document. Business decisions made after v1.2 are recorded in `BUSINESS_MODEL.md`, which takes precedence. In particular: **no driver subscription**, own drivers set up like restaurants, and processing fees on delivery paid from the delivery money.

Prepared for Shakib Hasan Haider \| 3 November 2026 \| Version 1.2

Contact: info@shlglobal.biz \| +1 917-624-8233\
Website: https://sendkoro.com \| Stripe account: acct_1UVa9IQzpvBKCndf

## Purpose and requested outcome

We are building Send Koro, a subscription-based food ordering platform.
We require customer orders to be charged directly on each restaurant's
connected Stripe account. Food-sale proceeds must not pass through Send
Koro's platform balance. Send Koro receives the agreed delivery
allocation plus driver tips for onward settlement and separately bills
monthly subscriptions.

This document records our business requirements, proposed Stripe
configuration, allocation formulas, and development acceptance criteria.
The proposed use of application fees for delivery collection and
subsequent driver funding requires Stripe technical confirmation before
production. It is not a statement of Stripe approval or an already
implemented configuration.

## Business model

Restaurants set menu prices and receive food-sale proceeds without a
Send Koro sales commission. Restaurants pay subscriptions of \$50 to
\$500 per month, selected using the previous calendar month's food sales
after refunds. Delivery may be paid by the customer, the restaurant, or
both in an agreed proportion. Own-network independent drivers may also
pay \$50 to \$500 monthly subscriptions based on prior-month delivery
earnings after refunds.

We are pre-launch. We project approximately \$200,000 in monthly
restaurant food sales by the end of the second month after launch. This
is an estimate, not current processing history.

## Required separation of funds

Restaurant allocations include food proceeds, restaurant service charges
and taxes payable to the restaurant under the approved tax arrangement.
Delivery allocations collected by Send Koro fund fulfillment and must be
tracked separately from subscription revenue. A Connect transfer moves
Stripe funds between accounts; a payout moves available funds to a bank
account. Neither guarantees an immediate bank deposit.

# Roles and responsibility

  ------------------------------------------------------------------------
  **Party**     **Role and responsibility**
  ------------- ----------------------------------------------------------
  Customer      Orders from an identified restaurant; sees food, delivery
                contribution, tax and tip separately; pays the disclosed
                total.

  Restaurant    Food seller; manages menu, acceptance and preparation;
                authorizes delivery subsidies; bears applicable order
                processing costs, refunds, disputes and payout fees under
                the supported account configuration.

  Send Koro     Provides ordering software and delivery coordination;
                collects delivery allocations and subscriptions; maintains
                allocation records, customer support routing and
                reconciliation.

  Stripe        Processes payments; onboards and verifies accounts;
                applies fees and risk responsibilities according to the
                actual account configuration and Stripe agreements.

  Own-network   Independent delivery contractor onboarded to receive
  driver        supported transfers; fulfills assigned deliveries and
                receives agreed delivery earnings and tips.

  Third-party   Fulfills delivery through its API and drivers; bills or
  supplier      receives funds according to its separate commercial
                agreement. Its drivers are not automatically Send Koro
                connected accounts.
  ------------------------------------------------------------------------

## Restaurant liability and customer presentation

Our intended account arrangement bills restaurant payment fees directly
to restaurants, debits refunds and disputes from restaurant balances,
and assigns unrecoverable connected-account payment losses to Stripe
rather than Send Koro. Stripe must confirm eligibility. This does not
remove Send Koro's obligations for its own subscription charges,
delivery arrangements, misconduct or platform balance.

Restaurant identity must be consistent at checkout, on receipts, in
statements and in customer terms for the proposed direct-charge model.
Stripe must confirm that our branded marketplace presentation fits this
arrangement. Account settings do not by themselves settle legal or tax
responsibilities. \[1--3\]

## Delivery consent

A restaurant must expressly authorize customer-paid, restaurant-paid or
shared delivery offers. Store the accepted rule, amount or percentage,
cap, validity, eligibility conditions and version. Checkout must use a
recorded quote and subsidy snapshot. Staff must not change an already
accepted order's subsidy without an agreed adjustment process.

# Payment allocation and delivery contributions

## Definitions and invariant

Use integer cents. F = food subtotal after food discounts and before
tax; D = final agreed delivery amount to fund; R = restaurant delivery
contribution; C = customer delivery contribution. Require C + R = D,
with all values nonnegative and R no greater than D. Calculate
percentage contributions from D and assign rounding remainder
deterministically.

Let S = restaurant service charges; X = VAT or tax payable to the
restaurant under the approved tax arrangement; T = driver tip. Q = F +
S + X + C + T; A = D + T; restaurant retained amount before Stripe fees
= F + S + X − R. The table uses S = X = T = \$0. Taxes payable elsewhere
require separate routing.

  ----------------------------------------------------------------------------------------------
  **Case**        **Food   **Delivery   **Customer   **Restaurant   **Charge   **Restaurant
                  F**      D**          C**          R**            Q**        net\***
  --------------- -------- ------------ ------------ -------------- ---------- -----------------
  Customer pays   \$30     \$10         \$10         \$0            \$40       \$30
  all                                                                          

  Restaurant pays \$30     \$10         \$0          \$10           \$30       \$20
  all                                                                          

  Equal           \$30     \$10         \$5          \$5            \$35       \$25
  partnership                                                                  

  Restaurant pays \$30     \$10         \$7          \$3            \$37       \$27
  30%                                                                          
  ----------------------------------------------------------------------------------------------

\*Before Stripe fees and excluding tax and tips. In every row, Send Koro
receives the \$10 delivery allocation for fulfillment; it is not a \$10
food commission.

## Proposed direct charge routing

Create the customer charge in the restaurant's connected-account
context, with application_fee_amount equal to D + T, subject to Stripe
approval. Stripe allocates D + T to Send Koro and retains the remainder,
less applicable Stripe fees, on the restaurant account. There is no
restaurant transfer from Send Koro because the charge already belongs to
the restaurant. Do not use a platform charge with transfer_data as a
substitute. \[1,2\]

application_fee_amount is Stripe's API term; our ledger and agreements
must identify this as a delivery fulfillment allocation. We collect
delivery budget D, including both parties' contributions, plus the full
driver tip T. Restaurant-funded delivery discounts never reduce or
replace the driver tip.

## Validation and changes

Reject a quote if the restaurant cannot fund R from the order proceeds
and no separately authorized funding method exists. Respect Stripe
application-fee limits and allow enough proceeds for agreed fees. If
supplier cost changes, apply an agreed cap or request approval; never
silently increase a restaurant subsidy. Multi-restaurant carts are out
of scope for the initial single-restaurant charge design.

# Restaurant invoice items and allocation

## Restaurant entitlement

The restaurant receives its food-sale amount, any properly disclosed
restaurant service charges, and applicable VAT or sales tax payable to
it under the approved tax arrangement. These amounts remain on the
restaurant's connected Stripe account after the delivery and driver-tip
allocation is transferred to Send Koro, less applicable Stripe fees and
the restaurant's agreed delivery contribution. Send Koro takes no
food-sales commission.

Tax amounts are collected funds for the responsible remitting entity and
are not treated as restaurant profit. Configure the responsible tax
collector and remitter before launch. If Send Koro, Stripe or another
entity must collect or remit a tax, route that tax accordingly rather
than automatically paying it to the restaurant. Do not charge VAT and
sales tax together merely because both labels are available.

## Restaurant settings and customer disclosure

Allow authorized restaurant staff to configure permitted service charges
as a fixed amount or percentage with a clear label, calculation basis
and effective period. Tax rates, tax codes, registrations and inclusive
or exclusive pricing must follow the approved jurisdiction settings and
validated tax calculation. Store taxability of service charges and
delivery separately. The customer must see all applicable charges before
confirming payment.

An itemized receipt must show food items and discounts, restaurant
service charges, each tax type and amount, customer delivery charge,
driver tip and total paid. The restaurant statement additionally shows
its delivery subsidy, Stripe fees, refunds and net balance. A service
charge is not automatically a driver tip; driver tips remain separately
identified and payable in full to the driver.

## Complete invoice example

  -----------------------------------------------------------------------
  **Invoice or allocation item**                        **Amount**
  ----------------------------------------------------- -----------------
  Food after discounts                                  \$30.00

  Restaurant service charge                             \$2.00

  Illustrative applicable tax collected for restaurant  \$2.40

  Customer delivery contribution                        \$5.00

  Driver tip                                            \$4.00

  Total customer payment                                \$43.40

  Restaurant delivery contribution from proceeds        \$5.00

  Total delivery budget including both contributions    \$10.00

  Allocation to Send Koro for delivery plus driver tip  \$14.00

  Restaurant retained before Stripe fees                \$29.40
  -----------------------------------------------------------------------

The \$2.40 tax is illustrative, not a recommended rate. Restaurant
allocation is \$30 + \$2 + \$2.40 − \$5 = \$29.40. Send Koro receives
\$10 delivery plus \$4 tip. Total allocations equal \$43.40. Stripe fees
reduce the restaurant balance separately. This example assumes the
approved tax arrangement pays the illustrated tax to the restaurant.

# Stripe configuration and pricing choices

  -----------------------------------------------------------------------
  **Area**        **Proposed choice**
  --------------- -------------------------------------------------------
  Products        Payments and Connect for orders; Billing for separate
                  subscriptions.

  Restaurant      Direct Charges on restaurant accounts.
  charge type     

  Connect pricing Stripe handles pricing for users. This concerns payment
                  processing, not our subscription price.

  Account API and Accounts v2 for a new integration; Stripe-hosted
  onboarding      onboarding.

  Restaurant      Full Stripe Dashboard; optional embedded reports in
  Dashboard       Send Koro.

  Fee collector   defaults.responsibilities.fees_collector = stripe.

  Loss collector  defaults.responsibilities.losses_collector = stripe,
                  subject to supported configuration.

  Billing pricing Pay-as-you-go at launch; no annual commitment proposed.

  Driver          Separate recipient configuration for transfers; confirm
  configuration   risk, fees and subscription compatibility with Stripe.
  -----------------------------------------------------------------------

## Fees and funding

Restaurants pay the processing fees on the entire direct charge,
including customer-paid delivery and tips, under the proposed
configuration. Restaurant payout charges depend on the payout product
and account pricing. Any reimbursement by Send Koro must be explicit.
Fees for Send Koro subscriptions, driver payments and other platform
activity remain platform costs unless contractually and technically
allocated otherwise. \[2\]

Stripe's US Connect pricing distinguishes Stripe-handled pricing from
platform-handled pricing. Confirm eligibility and the complete driver
transfer and payout fee schedule in writing. Do not assume a
no-additional-Connect-fee restaurant arrangement makes platform activity
free. Billing pay-as-you-go is currently listed at 0.7% of Billing
volume, plus applicable payment collection costs. Confirm current
pricing before launch. \[4,5\]

## Dashboard work and API work

In Dashboard, verify the legal operating entity, bank details, support
information, Connect profile and branding. Enable Billing and create
products and recurring prices. Use a sandbox before activation.
Developers must apply account responsibilities, direct-charge scoping,
delivery allocation, subscription tier automation and webhook
reconciliation in code. There is no Dashboard setting that automatically
implements this whole workflow.

# Subscription billing rules

## Restaurant subscriptions

Confirmed commercial rule: monthly fee between \$50 and \$500,
determined from the previous calendar month's net food sales. Net food
sales means food subtotal after food discounts minus food refunds.
Exclude delivery charges, restaurant delivery contributions, taxes,
tips, Stripe fees and subscription payments. Service-charge treatment in
the tier base remains a business decision; the proposed default excludes
service charges and uses food sales only. A restaurant's delivery
subsidy is an expense and must not reduce its food-sales tier base.

Example: October food sales of \$20,000 less \$1,000 in food refunds
produce a \$19,000 tier base for the November subscription. Apply the
agreed tier table; no thresholds are invented in this specification.

## Proposed implementation

Create Restaurant Subscription as a platform Billing product with a
monthly recurring price for each approved tier. Maintain one
subscription per restaurant billing entity. Use calendar-month
boundaries in America/New_York and a documented cutoff. Before invoice
finalization, calculate the prior month's tier base and apply the
corresponding price without a midmonth proration. \[6,7\]

A scheduled month-end job must complete tier selection before the
renewal invoice finalizes. Lock the calculation snapshot and retain the
period, food sales, food refunds, net base, rule version, price ID and
invoice ID. A monthly calculation choosing a fixed price is recommended;
metered billing is optional and requires a separately designed model.

## Collection and driver subscriptions

At launch, collect subscriptions through an authorized saved card or
supported bank method. Do not assume Stripe can debit pending balances
or automatically fall back between payment methods. Stripe balance
subscription payments are a preview with eligibility and
available-balance requirements; verify transfer-only drivers separately.
\[8\]

For own-network drivers, use an independent Driver Subscription product,
\$50 to \$500 monthly, based on the prior calendar month's delivery
earnings less delivery refunds, excluding tips. Driver thresholds may
differ from restaurant thresholds. Third-party suppliers are paid under
supplier agreements and are not assumed to owe a driver subscription.

## Commercial decisions required before launch

Approve exact tier thresholds and amounts; first-month pricing; no-sales
pricing; late-refund treatment; negative net-sales handling;
cancellation and access rules; failed-payment retries; and whether
multiple locations are billed separately. Proposed late-refund policy:
deduct food refunds in the month processed, reference their original
orders, and prevent double deductions. This proposal requires business
approval.

# Delivery settlement refunds and disputes

## Own-network driver settlement

Once delivery is completed and funds are available, create an idempotent
platform-to-driver transfer for the agreed driver delivery earnings plus
100% of the driver tip. Processing and payout fees must not reduce the
tip allocation; fund applicable costs separately. Record delivery
allocation received, supplier cost, transfer ID, payout status and tips
separately. Do not pay twice on repeated delivery events. Maintain
sufficient platform liquidity; receiving a delivery allocation does not
mean it is immediately available for transfer. Stripe must approve using
these application-fee receipts to fund driver transfers.

## Third-party fulfillment

Retain the collected delivery allocation in a fulfillment ledger until
the supplier obligation is settled. Pay Uber Direct, DoorDash or another
supplier using its agreed invoice, card or other payment process. A
provider API integration does not create a Connect recipient. Transfer
directly only if the supplier accepts this arrangement and Stripe
supports it. Reconcile quoted cost, actual cost, cancellation fees and
invoice adjustments.

## Refund allocation

Use separate refund components: food refund, customer delivery refund,
restaurant subsidy restoration, tax adjustment and tip adjustment. A
food-only refund should not automatically return a proportional delivery
allocation when delivery was fulfilled. Refund delivery allocations
explicitly; Stripe does not automatically return application fees. \[1\]

For an equal partnership order with F = \$30, D = \$10, C = \$5 and R =
\$5, the customer pays \$35. If cancelled before fulfillment with all
amounts reversible, refund \$35 on the restaurant charge and return the
\$10 delivery allocation from Send Koro to the restaurant. Ignoring
Stripe fees, the restaurant returns to zero net proceeds. Returning only
the customer's \$5 delivery portion would leave the restaurant funding
an unfulfilled \$5 subsidy.

If a driver or supplier has already been paid, recover or reverse funds
only where permitted; otherwise the agreed cancellation policy
determines who absorbs that cost. Subscription tier calculations deduct
the food refund only, not delivery refunds or restored subsidies.

## Disputes and tax

Direct-charge disputes affect the restaurant account under the approved
configuration. The parties still need procedures for delivery evidence,
allocation recovery and customer support. Delivery funds must not be
treated as guaranteed earnings while a dispute is unresolved. Tax
ownership, marketplace collection obligations, delivery tax and any
restaurant-staff tips must be separately confirmed; payment routing
alone does not establish them. \[2,3\]

# Driver tips and fulfillment settlement

## Tip ownership and checkout

Customer driver tips are optional and displayed separately from food,
delivery charges and taxes. Send Koro passes 100% of each driver tip to
the driver fulfilling the order, directly or through the delivery
supplier. Tips are not platform revenue, restaurant food sales, a
delivery subsidy or a substitute for agreed driver delivery pay. Exclude
tips from both restaurant and driver subscription tier calculations.

Track driver tips separately from any restaurant-staff tip. Store the
tip amount in cents, payer, order, driver or supplier, provider delivery
ID, API submission, settlement status and refund or adjustment history.
If a provider is changed, ensure only the actual fulfilling provider
receives the tip.

## Worked shared delivery example

Food \$30; delivery \$10; restaurant contribution \$5; customer
contribution \$5; customer driver tip \$4. Before tax, charge \$39
directly on the restaurant account. Proposed application_fee_amount is
\$14: \$10 delivery plus \$4 tip. The restaurant retains \$25 before
Stripe fees. For an own-network driver entitled to the full \$10
delivery fee, transfer \$14. For a third-party supplier, remit its
agreed delivery charge and the separate \$4 driver tip; confirm the
supplier passes the complete tip to its courier.

## Third party tipping integration

Submit the full tip through the supplier's dedicated tip field and pay
it using the supplier's supported billing method. A tip recorded only in
Send Koro or Stripe does not notify or pay an external courier. DoorDash
Drive documents the tip field in cents and requires passing 100% of the
collected tip to DoorDash for the Dasher. Reconcile the API
acknowledgement and supplier billing record. \[10\]

For Uber Direct, implement its current supported tip creation or update
flow after confirming the account contract and API version. Its FAQ
states that tips updated through Update Delivery can only increase; do
not assume a generic tip reversal or decrease is supported. Confirm how
to correct errors and handle cancellation with the supplier. \[11\]

## Settlement controls and testing

Do not deduct platform commission, subscription debt, delivery discounts
or Stripe fees from the tip principal. Separately fund applicable costs.
For later tip additions, use an authorized additional payment flow; do
not silently increase an already captured charge. Deduplicate retries
and keep unpaid tips as an outstanding obligation if settlement fails.

Handle tip refunds independently from food and delivery refunds, subject
to applicable rules and supplier restrictions. Do not automatically claw
back a fulfilled driver's tip. Test zero tip, preset and custom tips, a
shared-delivery order with a tip, provider reassignment, failed
remittance, repeated events and supported post-delivery tip increases.

# Developer workflow and acceptance criteria

## Order lifecycle

1\. Confirm restaurant onboarding, active payment capabilities and
accepted delivery subsidy terms. Obtain the supplier quote and freeze F,
S, X, D, C, R and T for checkout.

2\. Create one order ID and a direct-charge Checkout Session or
PaymentIntent in the restaurant context. Set the approved delivery
allocation; record connected-account and Stripe object IDs.

3\. Confirm payment through verified server events. Trigger fulfillment
only when the configured payment method has succeeded. Coordinate
restaurant acceptance and payment capture to avoid unfulfillable paid
orders.

4\. Track delivery assignment, completion and cancellation. Pay an
own-network driver or reconcile the third-party obligation once the
agreed conditions are met.

5\. Reconcile direct charges, Stripe fees, delivery allocations,
refunds, driver transfers and payouts. Calculate monthly subscription
tiers from the food ledger.

## Required records and controls

Persist order and restaurant IDs; connected-account ID; food, discounts,
restaurant service charges, tax breakdown and tax recipient, and tip;
tip recipient and settlement state; quote and expiry; contribution rule
and consent version; customer and restaurant contributions;
application-fee ID; charge and refund IDs; driver or supplier ID; actual
fulfillment cost; transfer or supplier payment reference; subscription
tier snapshot and invoice IDs.

Use idempotency for charges, allocations, refunds and driver transfers.
Verify webhook signatures; handle retries and out-of-order events. Query
direct-charge objects in the restaurant account context. Maintain a
per-order ledger and distinguish pending, available, owed and paid
amounts. Keep secret keys on the server and limit access by role.
\[1,9\]

## Minimum acceptance tests

-   Customer pays all delivery; restaurant pays all; \$5 plus \$5
    shared; percentage share with rounding; restaurant service charges
    and inclusive or exclusive tax.

-   Declined payment, failed authentication, expired quote and
    insufficient restaurant proceeds.

-   Duplicate payment or completion event produces no duplicate charge
    or driver payment.

-   Food-only partial refund; full cancellation with subsidy
    restoration; delivery already paid.

-   Failed driver transfer, failed bank payout and supplier cost
    differing from quote.

-   Month boundary, food refund, late refund, no sales, tier change and
    failed subscription collection.

# Stripe review questions and source references

## Confirmation requested from Stripe

-   Approve or amend the proposed Direct Charges model with
    Stripe-collected restaurant fees, full Dashboard access and
    Stripe-managed connected-account losses.

-   Confirm application_fee_amount may represent delivery plus the full
    driver tip, including restaurant-funded delivery contributions, and
    support onward driver or supplier settlement without a food-sales
    commission.

-   Confirm permitted platform-to-driver transfers funded from those
    delivery application-fee receipts, including available-balance
    timing, recipient setup, loss responsibility, geographic limits and
    fees.

-   Confirm the restaurant's customer-facing merchant presentation is
    appropriate for our branded ordering platform and identify any
    required contractual or checkout changes.

-   Confirm billing eligibility for restaurants and transfer-only
    drivers, including whether Stripe balance payments are supported for
    either group.

-   Provide an account-specific written fee schedule and any live
    activation requirements. If this flow is unsupported, propose an
    alternative preserving direct restaurant food charges; do not switch
    silently to platform collection.

## Source references

Official documentation reviewed 3 November 2026. Product availability,
account eligibility and prices require account-specific confirmation.
These references support Stripe mechanics; our proposed contribution
rules and subscription policies are Send Koro requirements.

\[1\] Direct charges\
https://docs.stripe.com/connect/direct-charges?platform=web&ui=stripe-hosted

\[2\] Fee behavior on connected accounts\
https://docs.stripe.com/connect/direct-charges-fee-payer-behavior

\[3\] Risk and liability management\
https://docs.stripe.com/connect/risk-management

\[4\] Connect pricing\
https://stripe.com/connect/pricing

\[5\] Billing pricing\
https://stripe.com/billing/pricing

\[6\] Subscriptions with Connect\
https://docs.stripe.com/connect/subscriptions

\[7\] Change subscription prices\
https://docs.stripe.com/billing/subscriptions/change-price

\[8\] Pay with Stripe balance\
https://docs.stripe.com/payments/pay-with-balance

\[9\] Account setup and security\
https://docs.stripe.com/get-started/account/set-up

\[10\] DoorDash deliveries with tips\
https://developer.doordash.com/en-US/docs/drive/how_to/deliveries_with_tips/

\[11\] Uber Direct FAQ and tip updates\
https://developer.uber.com/docs/deliveries/faq
