a = int(input())
b = a
tong = 0
while a > 0 :
    tong += a % 10
    a //= 10
print(f"Tong cac chu so cua {b} la {tong}")