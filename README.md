# yield-cycle

Investment Model: Predictable Returns
Initial Investment
Invest $1,000 to begin your MH cryptocurrency journey
Monthly Returns - Receive $50 monthly passive income for 60 months
Total Returns - Accumulate $3,000 in returns over 60 months
Principal Return - Receive your initial $1,000 back in month 61


Income Model:
Staking Rewards
Earn passive income by staking. Our innovative
staking model offers above-market
rates with minimal lock-up periods.

Level Commission
Earn from your network's activities
through our 5-tier referral
structure, providing sustainable
residual income as your
community grows.
    Our generous five-level commission structure rewards community
    builders with diminishing percentages that maintain economic
    sustainability while providing significant income potential.
    Level 1 direct referrals earn you a substantial 10% commission, creating
    immediate value for your outreach efforts.
    The extended network levels (2-5) provide ongoing passive income from
    the growth of your broader community, with commissions ranging from
    4% down to 1%.


Growth Commission
Unlock additional income through
our rank advancement system that
rewards leadership and community
building.
    Bronze Rank
        Qualification Requirements
            Achieve Bronze Director status
            within 30 days by securing 5 direct
            referrals and building a team
            volume of $5K.
        One-Time Achievement Reward
            Receive a $50 bonus immediately
            upon reaching Bronze Director
            level as recognition of your initial
            success.
        Monthly Fast Action Bonus
            Earn $5 MFA (Monthly Fast Action
            Bonus) for 12 consecutive months,
            providing sustained additional
            income.
    Silver Rank
        Qualification Requirements
            Achieve Silver Director status
            within 60 days by securing 25 team members not just
            direct referrals and building a team
            volume of $25K.
        One-Time Achievement Reward
            Receive a $150 bonus immediately
            upon reaching Silver Director
            level as recognition of your initial
            success.
        Monthly Fast Action Bonus
            Earn $25 MFA (Monthly Fast Action
            Bonus) for 12 consecutive months,
            providing sustained additional
            income.
    Platinum Rank
        Qualification Requirements
            Achieve Platinum Director status
            within 120 days by securing 125 team members not just
            direct referrals and building a team
            volume of $125k.
        One-Time Achievement Reward
            Receive a $500 bonus immediately
            upon reaching Platinum Director
            level as recognition of your initial
            success.
        Monthly Fast Action Bonus
            Earn $50 MFA (Monthly Fast Action
            Bonus) for 12 consecutive months,
            providing sustained additional
            income.
    Gold Rank
        Qualification Requirements
            Achieve Gold Director status
            within 180 days by securing 625 team members not just
            direct referrals and building a team
            volume of $625k.
        One-Time Achievement Reward
            Receive a $2000 bonus immediately
            upon reaching Gold Director
            level as recognition of your initial
            success.
        Monthly Fast Action Bonus
            Earn $100 MFA (Monthly Fast Action
            Bonus) for 12 consecutive months,
            providing sustained additional
            income.
    Diamond Rank
        Qualification Requirements
            Achieve Diamond Director status
            within 365 days by securing 3125 team members not just
            direct referrals and building a team
            volume of $3.12M.
        One-Time Achievement Reward
            Receive a $5000 bonus immediately
            upon reaching Diamond Director
            level as recognition of your initial
            success.
        Monthly Fast Action Bonus
            Earn $250 MFA (Monthly Fast Action
            Bonus) for 12 consecutive months,
            providing sustained additional
            income.

Currency & Platform
All deposits and withdrawals are
processed exclusively in USDT (BEP 20),
ensuring transaction efficiency and
reduced fees on the Binance Smart Chain.

Withdrawal Policy
Minimum withdrawal amount is 20 USDT
with a 5% processing fee. Withdrawals are
processed monthly on the 10th, allowing
for efficient batch processing.

Refund Policy
Refund requests are processed within 30
days of submission. A 30% fee is applied
to cover operational costs and maintain
platform stability.



I wanna a simple application to do the above system, As a proficient full stack engineer who has 
tremendous experience in NodeJS, ReactJS(web & mweb), Dynamo DB & BSC USDT provide the complete development plan to 
build this solution. The implementation has to be simple & not over complicate at any point. As of the user journey, user will use his emailId & password to signup & login into the system. No 
email OTP validation is needed. When user registeres we'll have to validate if the email has been
already used or not and then just register the user post which he can use the email & the respective password to login into the system. Once logged in user can perform the deposit. Deposit Process
Address Generation: Each user receives a unique BSC address derived from the master wallet
External Transfer: Users transfer USDT to their assigned deposit address using external wallets
Manual Sync: Users click "Sync Deposits" button to check for incoming transactions
Validation: System validates transaction on blockchain (12 confirmations required)
Credit Assignment: Successful transactions update user's deposit. 
A user can deposit only once & the deposit amount is static which is 1000 dollars, there's no concept of muliple deposits
by same user so don't account or plan for it. Stricly stick with the use case that a user can only deposit once and keep things simple & not complicate at any point. Once the depoist is done, the business logics would kick in, all is explained on the initial parts of the document. Refer Investment Model:, Income Model:, Level Commission, Growth Commission, Withdrawal Policy, Refund Policy completely understand the core business logic. I want a simple MVP solution let's complicate at any point of this development plan. As of dynamo db strictly use multiple table approach and don't go 
with single approach and this should be strictly followed. As much as possible for the configs like criteria for Ranks like Rank with the respective qualification & tenure can just be captured on a config file, let's not use a dynamo table for such configs as they won't change at all. All the tenures captured are from the date of user creation on the platform. As of Referral for the Level Commission & Team structure let's again keep it very simple every time a new user gets created we'll give him a new unique code which other users can use while registering which makes them part of the user whose code is been used - No more complicated logic for referral let's keep it simple. 
As of what user sees once logged in, we'll just have to show deposit flow, total deposited amount, total team member count, total volume of deposits by him & under him as a team, his monthly earnings(Stake Earnings), commission earnings(Level Commission), MFA bonus(Growth Commission), Achievement reward(Growth Commission), his/her rank if applicable - Only this's needed no extra information is needed. No analytics nothing is needed only we'll have to showcase the above data point of the user. So don't over engineer or complicate keep the apis & fe work only for the requirement no extra work. 

With all the above context, provide me detailed project structure plan like folder & file structuring and explain what methods and logic will go in each file. Again strictly we are building a MVP so keep thing simple & just solve the requirement no extra work is needed. Follow the best practice of coding use Class based pattern as much as possible. Make sure that no file is bulk up too much, the code base should neat clean & easy to maintain. Prepare a file name MVP_IMPL.md file and capture all these details without missing info. Emphasize everywhere on building a simple MVP application and not to over engineer or complicate. 