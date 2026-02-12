# Đề: 
# Cho dãy a gồm n số nguyên, dãy b gồm m số nguyên
# Đếm xem số các chọn a[i] != b[j]

# Ví dụ 1:
# 3
# 1 2 3
# 4
# 3 3 3 1
# Kết quả: 8

# Ví dụ 2:
# 5
# 1 1 2 2 2
# 5
# 2 2 2 1 1
# Kết quả: 12

a = list(map(int,input().split()))
b = list(map(int,input().split()))
tong = 0
d = {}
for i in a:
    d[i] = d.get(i, 0) + 1
for k, v in d.items():
    for i in b:
        if k != i:
            tong = tong + v
print(tong)
